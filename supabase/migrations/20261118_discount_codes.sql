-- Discount codes (e.g. BLACKFRIDAY = 30% off) that hosts create per event.
--
-- How a code is redeemed, end to end:
--   1. Checkout calls /api/ticket-hold with the code. The server validates it
--      (active, inside its date window, allowed on this tier) and works out
--      the discounted unit price from the DB.
--   2. reserve_discounted_tickets (below) locks the code row, checks the
--      usage limit and one-per-email rule, places the normal ticket hold via
--      reserve_tickets, and stamps the hold with the code + unit price.
--   3. verify-payment and the webhook fallback read the unit price back off
--      the hold (by Paystack reference) — never from the buyer's browser or
--      Paystack metadata — so a discount can't be invented or inflated.
--   4. create_tickets_with_holds marks the hold 'consumed' as it already
--      does; consumed + still-active holds are what count as "uses".
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once, BEFORE deploying the
-- matching app code. Safe to re-run. Additive only — nothing is dropped,
-- deleted or truncated; existing functions are not modified.

-- 1. The codes ---------------------------------------------------------------
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  -- Stored upper-case; buyers can type it in any case.
  code text not null check (code ~ '^[A-Z0-9_-]{3,20}$'),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  -- percent: 1-50 (% off). fixed: naira off per ticket (per table on table
  -- tiers), and never more than half the ticket's price when applied.
  amount numeric not null check (amount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  -- Max tickets (units — tables count as one) sold with this code. null = unlimited.
  max_uses integer check (max_uses is null or max_uses > 0),
  one_per_email boolean not null default false,
  -- null = every public tier of the event.
  tier_ids uuid[],
  -- On flexible group tiers with a bulk discount: true = apply both,
  -- false = buyer gets whichever of the two is bigger.
  stacks_with_bulk boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discount_codes_percent_cap check (discount_type <> 'percent' or amount <= 50),
  constraint discount_codes_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create unique index if not exists discount_codes_event_code_key
  on public.discount_codes (event_id, code);

-- Server-only: RLS on with no policies. Hosts manage codes through
-- /api/discount-codes, which checks event ownership with the service role.
alter table public.discount_codes enable row level security;

-- 2. Remember which code (and price) a hold was placed with -----------------
alter table public.ticket_holds add column if not exists discount_code_id uuid;
alter table public.ticket_holds add column if not exists unit_price numeric;

create index if not exists idx_ticket_holds_discount_code
  on public.ticket_holds (discount_code_id) where discount_code_id is not null;

-- 3. Tickets (units) already taken by a code: paid, or mid-payment ----------
create or replace function public.discount_code_used_quantity(p_code_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(quantity), 0)
    from public.ticket_holds
    where discount_code_id = p_code_id
      and (status = 'consumed' or (status = 'active' and expires_at > now()));
$$;

-- 4. Reserve tickets at a discounted price, atomically ----------------------
create or replace function public.reserve_discounted_tickets(
  p_code_id uuid,
  p_tier_id uuid,
  p_event_id uuid,
  p_quantity numeric,
  p_email text,
  p_reference text,
  p_unit_price numeric,
  p_ttl_seconds integer default 600
)
returns jsonb
language plpgsql
as $$
declare
  v_code record;
  v_used numeric;
  v_hold jsonb;
begin
  -- Lock the code so two buyers can't both take the last use.
  select id, max_uses, one_per_email, is_active
    into v_code
    from public.discount_codes
    where id = p_code_id and event_id = p_event_id
    for update;

  if not found or not v_code.is_active then
    return jsonb_build_object('ok', false, 'reason', 'CODE_INVALID');
  end if;

  if v_code.one_per_email and exists (
    select 1 from public.ticket_holds
      where discount_code_id = p_code_id
        and lower(email) = lower(p_email)
        and reference <> p_reference
        and (status = 'consumed' or (status = 'active' and expires_at > now()))
  ) then
    return jsonb_build_object('ok', false, 'reason', 'CODE_ALREADY_USED');
  end if;

  if v_code.max_uses is not null then
    v_used := public.discount_code_used_quantity(p_code_id);
    if v_used + p_quantity > v_code.max_uses then
      return jsonb_build_object('ok', false, 'reason', 'CODE_USED_UP',
        'remaining', greatest(v_code.max_uses - v_used, 0));
    end if;
  end if;

  v_hold := public.reserve_tickets(p_tier_id, p_event_id, p_quantity, p_email, p_reference, p_ttl_seconds);

  if coalesce((v_hold->>'ok')::boolean, false) then
    update public.ticket_holds
      set discount_code_id = p_code_id, unit_price = p_unit_price
      where reference = p_reference;
  end if;

  return v_hold;
end;
$$;

-- Server-only (service_role), like the other hold functions.
revoke all on function public.discount_code_used_quantity(uuid) from public, anon, authenticated;
grant execute on function public.discount_code_used_quantity(uuid) to service_role;
revoke all on function public.reserve_discounted_tickets(uuid, uuid, uuid, numeric, text, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.reserve_discounted_tickets(uuid, uuid, uuid, numeric, text, text, numeric, integer) to service_role;
