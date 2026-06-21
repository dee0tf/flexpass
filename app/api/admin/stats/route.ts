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
    { count: totalEvents },
    { count: totalTickets },
    { count: scannedTickets },
    { data: soldTickets },
    { data: pendingPayoutRows },
    { data: paidPayoutRows },
    { count: pendingDeleteCount },
    { data: hostRows },
  ] = await Promise.all([
    db.from("events").select("*", { count: "exact", head: true }),
    db.from("tickets").select("*", { count: "exact", head: true }).eq("status", "valid"),
    db.from("tickets").select("*", { count: "exact", head: true }).eq("status", "scanned"),
    db.from("tickets").select("total_amount_paid").in("status", ["valid", "scanned"]),
    db.from("payouts").select("amount").eq("status", "pending"),
    db.from("payouts").select("amount").eq("status", "paid"),
    db.from("delete_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("events").select("user_id, organizer_verified"),
  ]);

  // Count distinct hosts from events table
  const hostSet = new Set((hostRows || []).map((e: any) => e.user_id));
  const verifiedHostSet = new Set((hostRows || []).filter((e: any) => e.organizer_verified).map((e: any) => e.user_id));

  // Total registered users from auth.users (profiles only holds users who set up bank details)
  let totalUsers = 0;
  {
    let page = 1;
    while (true) {
      const { data: { users } } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      totalUsers += (users || []).length;
      if (!users || users.length < 1000) break;
      page++;
    }
  }

  const totalRevenue = (soldTickets || []).reduce((acc, t) => acc + (t.total_amount_paid || 0), 0);
  const pendingPayoutAmount = (pendingPayoutRows || []).reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalPaidOut = (paidPayoutRows || []).reduce((acc, p) => acc + (p.amount || 0), 0);

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    totalHosts: hostSet.size,
    verifiedHosts: verifiedHostSet.size,
    totalEvents: totalEvents || 0,
    totalTickets: (totalTickets || 0) + (scannedTickets || 0),
    scannedTickets: scannedTickets || 0,
    totalRevenue,
    totalPaidOut,
    pendingPayouts: pendingPayoutRows?.length || 0,
    pendingPayoutAmount,
    pendingDeletes: pendingDeleteCount || 0,
  });
}
