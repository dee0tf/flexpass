-- Discount codes: let hosts EXCLUDE ticket types instead of listing the ones
-- a code works on. A code now works on every public ticket type except
-- these, including ticket types added after the code was made.
-- Additive only: the old tier_ids column is kept and still honoured.

alter table public.discount_codes
  add column if not exists excluded_tier_ids uuid[];
