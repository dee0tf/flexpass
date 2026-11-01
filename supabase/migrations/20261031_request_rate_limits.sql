-- Per-IP rate limiting for unauthenticated ticket endpoints (ticket holds
-- and free-ticket claims). Without it, a script rotating fake emails could
-- hold every remaining ticket for an event, or drain a free event.
--
-- Additive only: creates a new table + index, touches nothing existing.
-- RLS on with zero policies — only the service role (API routes) can use it.
-- Safe to re-run.

create table if not exists public.request_rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,          -- e.g. 'ticket-hold:<event_id>:<ip>'
  created_at timestamptz not null default now()
);

create index if not exists request_rate_limits_bucket_created_idx
  on public.request_rate_limits (bucket, created_at desc);

alter table public.request_rate_limits enable row level security;
