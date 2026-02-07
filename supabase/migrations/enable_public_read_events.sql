-- Drop the existing policy to avoid conflicts
drop policy if exists "Public events are viewable by everyone" on "public"."events";

-- Enable Row Level Security (RLS) on the table if not already enabled
alter table "public"."events" enable row level security;

-- Create a policy that allows everyone to view events
create policy "Public events are viewable by everyone"
on "public"."events"
for select
to public
using ( true );
