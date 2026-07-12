-- Fixes ticket overselling caused by a check-then-insert race condition:
-- verify-payment / claim-free-ticket / issue-ticket / the Paystack webhook
-- fallback each checked "is there room?" and then inserted the ticket(s) as
-- two separate requests, with no lock between them. Two simultaneous buyers
-- going for the last spot could both pass the check and both insert.
--
-- This function does the capacity check and the insert in a single
-- transaction, holding a row lock on the tier (or event, for legacy no-tier
-- events) for the duration, so a concurrent call for the same tier blocks
-- until the first one commits or rolls back — no more double-selling the
-- last slot.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run
-- (CREATE OR REPLACE).

create or replace function public.create_tickets_atomic(
  p_tier_id uuid,
  p_event_id uuid,
  p_quantity numeric,
  p_tickets jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_group_size numeric := 1;
  v_quantity_available numeric := 0;
  v_sold_count numeric := 0;
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

  return jsonb_build_object('ok', true, 'tickets', coalesce(v_inserted, '[]'::jsonb));
end;
$$;

-- Only the server (service_role key) may call this — it bypasses the
-- higher-level checks (payment verification, sales cutoff, anti-bulk-buying)
-- that the API routes do before calling it, so it must never be reachable
-- from a browser client using the anon/authenticated key.
revoke all on function public.create_tickets_atomic(uuid, uuid, numeric, jsonb) from public;
revoke all on function public.create_tickets_atomic(uuid, uuid, numeric, jsonb) from anon;
revoke all on function public.create_tickets_atomic(uuid, uuid, numeric, jsonb) from authenticated;
grant execute on function public.create_tickets_atomic(uuid, uuid, numeric, jsonb) to service_role;
