-- Host brand logos for the homepage "Trusted by" slider.
--
-- Optional for every host: they're prompted to add one in the dashboard but
-- can always skip. `show_in_trusted_by` defaults to true (the checkbox next to
-- the upload is pre-ticked) and hosts can untick it to keep their logo off the
-- homepage.
--
-- Additive only — creates a new table, touches nothing existing.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

create table if not exists public.host_brands (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  brand_name         text,
  logo_url           text,
  show_in_trusted_by boolean not null default true,
  updated_at         timestamptz not null default now(),
  -- Logos must come from our own Supabase storage, never an arbitrary URL
  -- someone could later swap for something else on the homepage.
  constraint host_brands_logo_url_check
    check (logo_url is null or logo_url like 'https://%.supabase.co/storage/v1/object/public/%')
);

alter table public.host_brands enable row level security;

do $$
begin
  -- Anyone (the homepage) can read brands that opted in and have a logo
  if not exists (select 1 from pg_policies where tablename = 'host_brands' and policyname = 'Public reads opted-in brands') then
    create policy "Public reads opted-in brands" on public.host_brands
      for select using (show_in_trusted_by and logo_url is not null);
  end if;

  -- Hosts can read and write only their own row
  if not exists (select 1 from pg_policies where tablename = 'host_brands' and policyname = 'Hosts read own brand') then
    create policy "Hosts read own brand" on public.host_brands
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'host_brands' and policyname = 'Hosts insert own brand') then
    create policy "Hosts insert own brand" on public.host_brands
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'host_brands' and policyname = 'Hosts update own brand') then
    create policy "Hosts update own brand" on public.host_brands
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
