-- Adds "secret"/unlisted events: hosts can create an event that never
-- appears on the home page, the /events browse page, or the sitemap, but
-- is still fully purchasable by anyone who has the direct /events/[id]
-- link — the event detail page and checkout flow query by id and never
-- filter on this flag.
--
-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor
-- (Project -> SQL Editor -> New query) and run it once. Safe to re-run.

alter table public.events
  add column if not exists is_unlisted boolean not null default false;

comment on column public.events.is_unlisted is
  'When true, event is hidden from public listings (home, /events, sitemap) but still reachable via its direct /events/[id] link.';
