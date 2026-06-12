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

  const [
    { count: totalUsers },
    { count: totalEvents },
    { count: totalTickets },
    { data: soldTickets },
    { data: pendingPayoutRows },
    { count: pendingDeleteCount },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("events").select("*", { count: "exact", head: true }),
    db.from("tickets").select("*", { count: "exact", head: true }).eq("status", "valid"),
    db.from("tickets").select("total_amount_paid").in("status", ["valid", "scanned"]),
    db.from("payouts").select("amount").eq("status", "pending"),
    db.from("delete_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const totalRevenue = (soldTickets || []).reduce((acc, t) => acc + (t.total_amount_paid || 0), 0);
  const pendingPayoutAmount = (pendingPayoutRows || []).reduce((acc, p) => acc + (p.amount || 0), 0);

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    totalEvents: totalEvents || 0,
    totalTickets: totalTickets || 0,
    totalRevenue,
    pendingPayouts: pendingPayoutRows?.length || 0,
    pendingPayoutAmount,
    pendingDeletes: pendingDeleteCount || 0,
  });
}
