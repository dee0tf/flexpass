import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role: the tickets table isn't publicly readable. This is the
// no-login path the FlexPass attendee app uses to load a purchase's tickets
// onto the phone — same rule as the /tickets/[id] page, the unguessable
// ticket ID is the access key, so only rows the caller already holds IDs
// for are ever returned.
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// One checkout's worth — enough for any real order, too few to be useful for scraping
const MAX_IDS = 20;

const TICKET_FIELDS = "id, event_id, user_email, user_name, user_gender, status, tier_name, checked_in_at, total_amount_paid, created_at, events(id, title, date, start_time, location, image_url, location_reveal)";

export async function POST(request: Request) {
  let ids: unknown;
  try {
    ({ ids } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every(id => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json({ error: `Send 1–${MAX_IDS} ticket IDs` }, { status: 400 });
  }

  const { data, error } = await db.from("tickets").select(TICKET_FIELDS).in("id", ids);
  if (error) return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
  return NextResponse.json({ tickets: data || [] });
}
