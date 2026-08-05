-- Optional free-text description per ticket tier — lets a host explain
-- what's included in a tier (e.g. a "Table of 5" bundle: what's on the
-- table, bottle service, seating info) so buyers know what they're paying
-- for before checkout.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

alter table public.ticket_tiers
  add column if not exists description text;
