import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verifyAdmin(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

// GET — list all hosts with event count, ticket count, revenue, verified status
export async function GET(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All events grouped by user_id
  const { data: events } = await db
    .from("events")
    .select("id, user_id, organizer_name, organizer_verified, title");

  if (!events?.length) return NextResponse.json({ hosts: [] });

  // Tickets sold per event
  const { data: tickets } = await db
    .from("tickets")
    .select("event_id, total_amount_paid")
    .in("status", ["valid", "scanned"]);

  // Build per-user aggregates
  const userMap = new Map<string, {
    user_id: string; organizer_name: string;
    events: number; tickets: number; revenue: number; verified: boolean;
  }>();

  for (const e of events) {
    const existing = userMap.get(e.user_id) ?? {
      user_id: e.user_id, organizer_name: e.organizer_name || "—",
      events: 0, tickets: 0, revenue: 0, verified: false,
    };
    existing.events += 1;
    if (e.organizer_verified) existing.verified = true;
    userMap.set(e.user_id, existing);
  }

  const eventIds = new Set(events.map(e => e.id));
  for (const t of tickets || []) {
    if (!eventIds.has(t.event_id)) continue;
    const ev = events.find(e => e.id === t.event_id);
    if (!ev) continue;
    const host = userMap.get(ev.user_id);
    if (host) { host.tickets += 1; host.revenue += t.total_amount_paid || 0; }
  }

  // Get emails from auth.users via admin API
  const { data: { users: authUsers } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(authUsers.map((u: any) => [u.id, u.email]));

  const hosts = Array.from(userMap.values()).map(h => ({
    ...h,
    email: emailMap.get(h.user_id) || "unknown",
  })).sort((a, b) => b.events - a.events);

  return NextResponse.json({ hosts });
}

// POST — toggle verified status for all events by a host
export async function POST(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, verified } = await request.json();
  if (!userId || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Missing userId or verified" }, { status: 400 });
  }

  const { error } = await db
    .from("events")
    .update({ organizer_verified: verified })
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
