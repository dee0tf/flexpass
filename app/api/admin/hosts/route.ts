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

// GET — list all registered users with event count, ticket count, revenue, verified status
export async function GET(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch ALL auth users with pagination
  let allAuthUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users } } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    allAuthUsers = allAuthUsers.concat(users);
    if (users.length < 1000) break;
    page++;
  }

  // All events
  const { data: events } = await db
    .from("events")
    .select("id, user_id, organizer_name, organizer_verified");

  // All sold tickets
  const { data: tickets } = await db
    .from("tickets")
    .select("event_id, total_amount_paid")
    .in("status", ["valid", "scanned"]);

  // Build event/ticket stats per user
  const statsMap = new Map<string, {
    organizer_name: string; events: number; tickets: number; revenue: number; verified: boolean;
  }>();

  for (const e of events || []) {
    const s = statsMap.get(e.user_id) ?? {
      organizer_name: e.organizer_name || "—", events: 0, tickets: 0, revenue: 0, verified: false,
    };
    s.events += 1;
    if (e.organizer_verified) s.verified = true;
    statsMap.set(e.user_id, s);
  }

  const eventOwner = new Map((events || []).map(e => [e.id, e.user_id]));
  for (const t of tickets || []) {
    const userId = eventOwner.get(t.event_id);
    if (!userId) continue;
    const s = statsMap.get(userId);
    if (s) { s.tickets += 1; s.revenue += t.total_amount_paid || 0; }
  }

  // Build final list from ALL auth users
  const hosts = allAuthUsers.map((u: any) => {
    const s = statsMap.get(u.id);
    return {
      user_id: u.id,
      email: u.email || "unknown",
      organizer_name: s?.organizer_name || u.user_metadata?.full_name || "—",
      events: s?.events || 0,
      tickets: s?.tickets || 0,
      revenue: s?.revenue || 0,
      verified: s?.verified || false,
    };
  }).sort((a, b) => b.events - a.events || a.email.localeCompare(b.email));

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
