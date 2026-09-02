-- Flexible group / family tickets: unlike the existing fixed `group_size`
-- bundle ("Table of 5", one price for a preset bundle), this lets a buyer
-- pick their own headcount (with a host-set minimum, e.g. 10) and get a
-- per-ticket discount once they go above a host-set threshold.
--
-- All columns are nullable and opt-in per tier — existing tiers/events are
-- unaffected unless a host explicitly sets min_quantity on a tier.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

alter table public.ticket_tiers
  add column if not exists min_quantity integer,
  add column if not exists bulk_discount_qty integer,
  add column if not exists bulk_discount_percent numeric;

alter table public.ticket_tiers
  drop constraint if exists ticket_tiers_min_quantity_check,
  drop constraint if exists ticket_tiers_bulk_discount_qty_check,
  drop constraint if exists ticket_tiers_bulk_discount_percent_check;

alter table public.ticket_tiers
  add constraint ticket_tiers_min_quantity_check
    check (min_quantity is null or min_quantity > 0),
  add constraint ticket_tiers_bulk_discount_qty_check
    check (bulk_discount_qty is null or bulk_discount_qty > 0),
  add constraint ticket_tiers_bulk_discount_percent_check
    check (bulk_discount_percent is null or (bulk_discount_percent >= 0 and bulk_discount_percent <= 100));
