-- Fixes "paid but no ticket" on the last few tickets of a tier. Previously
-- capacity was only checked AFTER Paystack had taken the money, so two
-- buyers could both open checkout for the last slot, both pay, and the
-- slower one was charged with nothing issued (manual refund/resolution).
--
-- Now a buyer reserves their tickets BEFORE Paystack opens: reserve_tickets
-- places a short hold (default 10 minutes) under the same tier/event row
-- lock create_tickets_atomic uses. While a hold is active nobody else can
-- take those slots, so the first person to click Pay gets them. If they close
-- Paystack without paying the hold is released immediately; if they just
-- walk away it simply expires and the slots go back on sale.
--
-- create_tickets_with_holds replaces create_tickets_atomic for all callers
-- (via lib/createTicketsAtomic.ts). It takes the purchase reference: the
-- buyer's own hold doesn't count against them, everyone else's active holds
-- do, and the hold is marked consumed once the tickets are inserted. Callers that don't
-- pass a reference (free claims, giveaways) just respect other people's
-- holds.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once, BEFORE deploying
-- the matching app code. Safe to re-run. Additive only — nothing is dropped:
-- the old create_tickets_atomic is left in place (unused once the new code
-- is deployed), so the currently deployed code keeps working in between.

create table if not exists ticket_holds (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  event_id uuid not null,
  tier_id uuid,
  quantity numeric not null check (quantity > 0),
  email text,
  status text not null default 'active' check (status in ('active', 'consumed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_holds_tier_active
  on ticket_holds (tier_id, expires_at) where status = 'active';
create index if not exists idx_ticket_holds_event_active
  on ticket_holds (event_id, expires_at) where status = 'active';

-- Server-only table: RLS on with no policies, so only service_role can touch it.
alter table ticket_holds enable row level security;

-- Units (groups, for group tiers) currently held by OTHER buyers.
create or replace function public.active_held_quantity(
  p_tier_id uuid,
  p_event_id uuid,
  p_exclude_reference text
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(quantity), 0)
    from ticket_holds
    where status = 'active'
      and expires_at > now()
      and (p_exclude_reference is null or reference <> p_exclude_reference)
      and (
        (p_tier_id is not null and tier_id = p_tier_id)
        or (p_tier_id is null and tier_id is null and event_id = p_event_id)
      );
$$;

create or replace function public.reserve_tickets(
  p_tier_id uuid,
  p_event_id uuid,
  p_quantity numeric,
  p_email text,
  p_reference text,
  p_ttl_seconds integer default 600
)
returns jsonb
language plpgsql
as $$
declare
  v_group_size numeric := 1;
  v_quantity_available numeric := 0;
  v_sold_count numeric := 0;
  v_held numeric := 0;
  v_remaining numeric;
  v_next_release timestamptz;
  v_expires_at timestamptz := now() + p_ttl_seconds * interval '1 second';
begin
  if p_tier_id is not null then
    select group_size, quantity_available
      into v_group_size, v_quantity_available
      from ticket_tiers
      where id = p_tier_id and event_id = p_event_id
      for update;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'TIER_NOT_FOUND');
    end if;

    v_group_size := coalesce(v_group_size, 1);

    select count(*) into v_sold_count
      from tickets
      where tier_id = p_tier_id
        and status in ('valid', 'scanned');

    v_remaining := coalesce(v_quantity_available, 0) - (v_sold_count / v_group_size);
  else
    perform 1 from events where id = p_event_id for update;

    select coalesce(total_tickets, 0) into v_quantity_available
      from events where id = p_event_id;

    select count(*) into v_sold_count
      from tickets
      where event_id = p_event_id
        and tier_id is null
        and status in ('valid', 'scanned');

    v_remaining := v_quantity_available - v_sold_count;
  end if;

  v_held := public.active_held_quantity(p_tier_id, p_event_id, p_reference);

  if v_remaining - v_held < p_quantity then
    -- Tells the buyer whether it's truly gone or just held by someone
    -- mid-payment (and when the earliest hold lapses), so the UI can say
    -- "try again in a few minutes" instead of a flat "sold out".
    if v_remaining >= p_quantity then
      select min(expires_at) into v_next_release
        from ticket_holds
        where status = 'active'
          and expires_at > now()
          and (
            (p_tier_id is not null and tier_id = p_tier_id)
            or (p_tier_id is null and tier_id is null and event_id = p_event_id)
          );
      return jsonb_build_object(
        'ok', false, 'reason', 'HELD',
        'remaining', greatest(v_remaining - v_held, 0),
        'next_release_at', v_next_release
      );
    end if;
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT', 'remaining', greatest(v_remaining - v_held, 0));
  end if;

  insert into ticket_holds (reference, event_id, tier_id, quantity, email, expires_at)
    values (p_reference, p_event_id, p_tier_id, p_quantity, p_email, v_expires_at)
    on conflict (reference) do update
      set quantity = excluded.quantity,
          expires_at = excluded.expires_at,
          status = 'active'
      where ticket_holds.status = 'active';

  return jsonb_build_object('ok', true, 'reference', p_reference, 'expires_at', v_expires_at);
end;
$$;

-- Buyer closed Paystack without paying — give the slots back right away.
create or replace function public.release_ticket_hold(p_reference text)
returns void
language sql
as $$
  update ticket_holds set status = 'released'
    where reference = p_reference and status = 'active';
$$;

create or replace function public.create_tickets_with_holds(
  p_tier_id uuid,
  p_event_id uuid,
  p_quantity numeric,
  p_tickets jsonb,
  p_reference text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_group_size numeric := 1;
  v_quantity_available numeric := 0;
  v_sold_count numeric := 0;
  v_held numeric := 0;
  v_remaining numeric;
  v_inserted jsonb;
begin
  if p_tier_id is not null then
    -- Lock the tier row so a concurrent call for the same tier can't read
    -- the same "remaining" value before either has inserted.
    select group_size, quantity_available
      into v_group_size, v_quantity_available
      from ticket_tiers
      where id = p_tier_id
      for update;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'TIER_NOT_FOUND');
    end if;

    v_group_size := coalesce(v_group_size, 1);

    select count(*) into v_sold_count
      from tickets
      where tier_id = p_tier_id
        and status in ('valid', 'scanned');

    -- sold_count counts individual ticket rows; quantity_available counts
    -- groups/units for group tiers, so convert back to the same unit.
    v_remaining := coalesce(v_quantity_available, 0) - (v_sold_count / v_group_size);
  else
    -- Legacy (no-tier) event — lock the event row instead.
    perform 1 from events where id = p_event_id for update;

    select coalesce(total_tickets, 0) into v_quantity_available
      from events where id = p_event_id;

    select count(*) into v_sold_count
      from tickets
      where event_id = p_event_id
        and tier_id is null
        and status in ('valid', 'scanned');

    v_remaining := v_quantity_available - v_sold_count;
  end if;

  -- Slots other buyers are currently paying for aren't available to us.
  -- Our own hold (matched by reference) is excluded, so it's what we use.
  v_held := public.active_held_quantity(p_tier_id, p_event_id, p_reference);
  v_remaining := v_remaining - v_held;

  if v_remaining < p_quantity then
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT', 'remaining', greatest(v_remaining, 0));
  end if;

  with ins as (
    insert into tickets (
      event_id, user_email, user_name, user_gender, status, is_giveaway,
      purchase_reference, fee_amount, total_amount_paid, tier_id, tier_name, referral_code
    )
    select
      (t->>'event_id')::uuid,
      t->>'user_email',
      t->>'user_name',
      t->>'user_gender',
      t->>'status',
      coalesce((t->>'is_giveaway')::boolean, false),
      t->>'purchase_reference',
      (t->>'fee_amount')::numeric,
      (t->>'total_amount_paid')::numeric,
      nullif(t->>'tier_id', '')::uuid,
      t->>'tier_name',
      t->>'referral_code'
    from jsonb_array_elements(p_tickets) as t
    returning *
  )
  select jsonb_agg(to_jsonb(ins)) into v_inserted from ins;

  if p_reference is not null then
    update ticket_holds set status = 'consumed' where reference = p_reference;
  end if;

  return jsonb_build_object('ok', true, 'tickets', coalesce(v_inserted, '[]'::jsonb));
end;
$$;

-- Server-only (service_role) — these bypass the API routes' higher-level
-- checks and must never be callable with the anon/authenticated key.
revoke all on function public.create_tickets_with_holds(uuid, uuid, numeric, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_tickets_with_holds(uuid, uuid, numeric, jsonb, text) to service_role;
revoke all on function public.reserve_tickets(uuid, uuid, numeric, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_tickets(uuid, uuid, numeric, text, text, integer) to service_role;
revoke all on function public.release_ticket_hold(text) from public, anon, authenticated;
grant execute on function public.release_ticket_hold(text) to service_role;
revoke all on function public.active_held_quantity(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.active_held_quantity(uuid, uuid, text) to service_role;
