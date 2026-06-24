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

export async function GET(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = new URL(request.url).searchParams.get("eventId");

  // ── Buyer list for a specific event ──
  if (eventId) {
    const { data: tickets, error } = await db
      .from("tickets")
      .select("id, user_name, user_email, tier_name, total_amount_paid, status, created_at, referral_code")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tickets: tickets || [] });
  }

  // ── All events ──
  const { data: events, error } = await db
    .from("events")
    .select("id, title, date, user_id, organizer_name, organizer_verified, image_url")
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ticket counts and revenue per event
  const { data: ticketRows } = await db
    .from("tickets")
    .select("event_id, total_amount_paid")
    .in("status", ["valid", "scanned"]);

  const ticketStats = new Map<string, { count: number; revenue: number }>();
  for (const t of ticketRows || []) {
    const s = ticketStats.get(t.event_id) ?? { count: 0, revenue: 0 };
    s.count  += 1;
    s.revenue += t.total_amount_paid || 0;
    ticketStats.set(t.event_id, s);
  }

  // Resolve host emails
  const userIds = [...new Set((events || []).map((e: any) => e.user_id as string))];
  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data: { user } } = await db.auth.admin.getUserById(uid);
      if (user?.email) emailMap.set(uid, user.email);
    })
  );

  const enriched = (events || []).map((e: any) => ({
    id:             e.id,
    title:          e.title,
    date:           e.date,
    image_url:      e.image_url,
    organizer_name: e.organizer_name || "—",
    verified:       e.organizer_verified || false,
    host_email:     emailMap.get(e.user_id) || `${e.user_id.slice(0, 8)}…`,
    tickets:        ticketStats.get(e.id)?.count   || 0,
    revenue:        ticketStats.get(e.id)?.revenue || 0,
  }));

  return NextResponse.json({ events: enriched });
}
