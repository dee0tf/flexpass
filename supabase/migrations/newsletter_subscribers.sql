-- Create a table for newsletter subscribers
create table if not exists "public"."newsletter_subscribers" (
  "id" uuid not null default gen_random_uuid(),
  "email" text not null,
  "created_at" timestamp with time zone default now(),
  constraint "newsletter_subscribers_pkey" primary key ("id"),
  constraint "newsletter_subscribers_email_key" unique ("email")
);

-- Enable Row Level Security (RLS)
alter table "public"."newsletter_subscribers" enable row level security;

-- Allow ANYONE (anon) to insert their email (Subscribe)
create policy "Anyone can subscribe"
on "public"."newsletter_subscribers"
for insert
to public
with check ( true );

-- Only Service Role (Admin) can view emails (Privacy)
create policy "Only admin can view subscribers"
on "public"."newsletter_subscribers"
for select
to service_role
using ( true );
