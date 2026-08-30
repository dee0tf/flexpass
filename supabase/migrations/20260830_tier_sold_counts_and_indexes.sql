-- Fixes a scale bottleneck on the event detail page (app/events/[id]/page.tsx),
-- the highest-traffic page in the app: it was running one head-count query per
-- ticket tier (plus one more for legacy no-tier events) on every single page
-- load to compute "remaining" tickets, with no index backing any of them and
-- no caching. For an event with N tiers, every visitor triggered N+1 separate
-- round trips to Postgres. Under an event-day traffic spike this is the page
-- most likely to exhaust the DB connection pool before checkout even happens.
--
-- This migration adds the indexes those lookups need, plus a single
-- aggregate RPC (get_tier_sold_counts) that replaces the N+1 queries with
-- one grouped count — including the legacy (tier_id IS NULL) bucket, which
-- comes back as a NULL tier_id row instead of needing its own query.
--
-- Aggregation happens inside Postgres via COUNT(*), which is exact
-- regardless of row count — unlike a plain PostgREST row-select (capped at
-- 1000 rows by default), so this doesn't reintroduce the truncation risk
-- the original per-tier head-count queries were written to avoid.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

create index if not exists idx_tickets_event_status on tickets (event_id, status);
create index if not exists idx_tickets_tier_status on tickets (tier_id, status);

create or replace function get_tier_sold_counts(p_event_id uuid)
returns table (tier_id uuid, sold_count bigint)
language sql
stable
as $$
  select tier_id, count(*) as sold_count
  from tickets
  where event_id = p_event_id
    and status in ('valid', 'scanned')
  group by tier_id;
$$;
