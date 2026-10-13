-- Locks the tickets table down. Until now anyone holding the public anon key
-- could read every ticket on the platform (buyer names, emails, gender,
-- amounts, check-in status) straight from the REST API or realtime.
--
-- After this:
--   * Buyers still need NO login. Their ticket opens from the post-purchase
--     redirect and the email link via server code using the service role
--     (app/tickets/[id], app/tickets/order, app/api/tickets/by-ids) — the
--     unguessable ticket ID in the link is the key.
--   * Hosts read tickets for their own events only (dashboard, attendance,
--     live check-in alerts, host app).
--   * A signed-in buyer with a CONFIRMED email can list their own tickets
--     (My Tickets page / attendee app). Unconfirmed emails get nothing, so
--     signing up with someone else's address doesn't reveal their tickets.
--   * Remaining-ticket counts go through get_tier_sold_counts, which now runs
--     with definer rights and returns only numbers.
--   * Writes stay service-role only (verify-payment, check-in, admin, etc.).
--
-- DEPLOY THE APP CODE FIRST — this must go out after the website changes
-- that stop reading tickets with the anon key, or ticket pages and sold-out
-- counts break in between.
--
-- Additive only: no DROP / DELETE / TRUNCATE. The old open policy is narrowed
-- with ALTER POLICY (section 5), not dropped. Safe to re-run.
--
-- HOW TO APPLY: paste into Supabase -> SQL Editor -> New query, run once.

-- 1. Indexes the new policies lean on --------------------------------------
create index if not exists idx_events_user_id on public.events (user_id);
create index if not exists idx_tickets_user_email_lower on public.tickets (lower(user_email));

-- 2. Sold counts keep working for logged-out visitors ----------------------
-- Same signature and body as 20260830_tier_sold_counts_and_indexes.sql; only
-- adds definer rights so it can count rows the caller can't read.
create or replace function public.get_tier_sold_counts(p_event_id uuid)
returns table (tier_id uuid, sold_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select tier_id, count(*) as sold_count
  from public.tickets
  where event_id = p_event_id
    and status in ('valid', 'scanned')
  group by tier_id;
$$;
grant execute on function public.get_tier_sold_counts(uuid) to anon, authenticated;

-- 3. The signed-in user's email, only once it's confirmed ------------------
create or replace function public.confirmed_auth_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(email) from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
$$;
grant execute on function public.confirmed_auth_email() to authenticated;

-- 4. Who may read tickets --------------------------------------------------
alter table public.tickets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tickets'
                 and policyname = 'Hosts read tickets for their events') then
    create policy "Hosts read tickets for their events" on public.tickets
      for select to authenticated
      using (exists (
        select 1 from public.events e
        where e.id = tickets.event_id and e.user_id = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tickets'
                 and policyname = 'Buyers read own tickets') then
    create policy "Buyers read own tickets" on public.tickets
      for select to authenticated
      using (lower(user_email) = public.confirmed_auth_email());
  end if;
end $$;

-- 5. Close the two existing open policies -----------------------------------
-- As of 2026-10-12 pg_policies showed, both for role {public} with `true`:
--   "Enable read access for all users"  SELECT  -> anyone could read every ticket
--   "Enable insert for everyone"        INSERT  -> anyone could create a "valid"
--                                                  ticket without paying
-- Nothing inserts or reads tickets with the anon key any more (all inserts go
-- through service-role API routes/RPCs), so both are narrowed to the service
-- role — which bypasses RLS anyway — instead of being dropped.
alter policy "Enable read access for all users" on public.tickets to service_role;
alter policy "Enable insert for everyone" on public.tickets to service_role;
