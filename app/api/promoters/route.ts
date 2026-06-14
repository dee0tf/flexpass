import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}${suffix}`;
}

async function authenticate(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await authClient.auth.getUser(token);
  return user || null;
}

// GET /api/promoters?eventId=xxx — list promoters with stats
export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId || !UUID_RE.test(eventId))
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });

  // Confirm user owns this event
  const { data: event } = await db.from("events").select("id, user_id").eq("id", eventId).single();
  if (!event || event.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: promoters } = await db
    .from("event_promoters")
    .select("id, name, code, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (!promoters?.length) return NextResponse.json({ promoters: [] });

  // Aggregate stats from tickets
  const codes = promoters.map((p: any) => p.code);
  const { data: tickets } = await db
    .from("tickets")
    .select("referral_code, total_amount_paid, status")
    .eq("event_id", eventId)
    .in("referral_code", codes)
    .in("status", ["valid", "scanned"]);

  const statsMap: Record<string, { tickets: number; revenue: number }> = {};
  for (const t of tickets || []) {
    if (!t.referral_code) continue;
    if (!statsMap[t.referral_code]) statsMap[t.referral_code] = { tickets: 0, revenue: 0 };
    statsMap[t.referral_code].tickets += 1;
    statsMap[t.referral_code].revenue += t.total_amount_paid || 0;
  }

  const result = promoters.map((p: any) => ({
    ...p,
    tickets: statsMap[p.code]?.tickets || 0,
    revenue: statsMap[p.code]?.revenue || 0,
  }));

  return NextResponse.json({ promoters: result });
}

// POST /api/promoters — create a promoter link
export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, name } = await request.json();
  if (!eventId || !UUID_RE.test(eventId) || !name?.trim())
    return NextResponse.json({ error: "Missing eventId or name" }, { status: 400 });

  const { data: event } = await db.from("events").select("id, user_id").eq("id", eventId).single();
  if (!event || event.user_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Generate a unique code (retry once on collision)
  let code = generateCode(name.trim());
  const { data: existing } = await db.from("event_promoters").select("id").eq("code", code).maybeSingle();
  if (existing) code = generateCode(name.trim());

  const { data, error } = await db
    .from("event_promoters")
    .insert({ event_id: eventId, host_user_id: user.id, name: name.trim(), code })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create promoter" }, { status: 500 });
  return NextResponse.json({ promoter: data });
}