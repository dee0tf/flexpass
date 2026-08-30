-- Lets a host hand door staff a scan-only access code instead of their own
-- login. Previously the only way to grant check-in access was to either be
-- the event's owner (via Supabase session) or the single ADMIN_EMAIL — a
-- host covering the door with volunteers/staff had no option but to share
-- their own account credentials.
--
-- scan_code is a short, host-generated code scoped to exactly one event.
-- Regenerating it (see app/dashboard/events/[id]/edit) overwrites the old
-- value, which immediately revokes any previously shared code/link since
-- app/api/checkin compares against whatever value is currently stored.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

alter table events add column if not exists scan_code text;

-- Partial unique index (rather than a plain unique column) so the many
-- events with no code set yet (scan_code IS NULL) don't collide with each
-- other under a unique constraint.
create unique index if not exists idx_events_scan_code
  on events (scan_code)
  where scan_code is not null;
