-- SECURITY FIX: events.scan_code (added in 20260830_add_event_scan_code.sql)
-- was stored on the same `events` row the public event page reads with the
-- ANON key (app/events/[id]/page.tsx uses select("*") with no session at
-- all). Row-level security is per-row, not per-column — a policy that lets
-- `anon` read a row's title/date/location also lets it read scan_code,
-- since nothing revoked column-level access separately. Verified live: a
-- test code written via the service-role key was readable seconds later via
-- a plain anon-key REST call, with no auth at all. That fully defeats the
-- entire point of the access-code feature — anyone who knows an event's ID
-- (which is public, it's in the URL) could read its scan_code directly and
-- bypass /api/scanner-auth's verification step entirely.
--
-- Fix: move scan_code to its own table with RLS enabled and ZERO policies.
-- Supabase/PostgREST denies all access under RLS unless a policy explicitly
-- grants it — an empty policy set means anon and authenticated get nothing,
-- and only the service-role key (used by every route that touches this:
-- /api/scanner-auth, /api/checkin, /api/admin/generate-scan-code, and the
-- new /api/host/generate-scan-code) can read or write it at all, since the
-- service role bypasses RLS entirely.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

create table if not exists event_scan_codes (
  event_id uuid primary key references events(id) on delete cascade,
  scan_code text not null,
  updated_at timestamptz not null default now()
);

alter table event_scan_codes enable row level security;
-- Intentionally no policies — see comment above.

-- Carry over any code already set on the old column before removing it.
insert into event_scan_codes (event_id, scan_code)
select id, scan_code from events where scan_code is not null
on conflict (event_id) do update set scan_code = excluded.scan_code;

drop index if exists idx_events_scan_code;
alter table events drop column if exists scan_code;
