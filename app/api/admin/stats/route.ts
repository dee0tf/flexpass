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
    { data: paystackFeeRows },
  ] = await Promise.all([
    db.from("events").select("*", { count: "exact", head: true }),
    db.from("tickets").select("*", { count: "exact", head: true }).eq("status", "valid"),
    db.from("tickets").select("*", { count: "exact", head: true }).eq("status", "scanned"),
    db.from("tickets").select("total_amount_paid").in("status", ["valid", "scanned"]),
    db.from("payouts").select("amount").eq("status", "pending"),
    db.from("payouts").select("amount").eq("status", "paid"),
    db.from("delete_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("events").select("user_id, organizer_verified"),
    // Real Paystack processing fee per charge — logged at ticket-creation
    // time (verify-payment / webhook / reconciliation) via logPaymentEvent,
    // and backfilled once for tickets that predate that logging. Needed
    // because the 5% we charge buyers doesn't equal what Paystack actually
    // keeps, so it can't be derived from ticket data alone.
    db.from("payment_events").select("reference, metadata").eq("event_type", "paystack_fee_recorded"),
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

  // The 5% service fee (CheckoutModal.tsx) is baked into total_amount_paid
  // rather than always split out in fee_amount — tickets created via the
  // webhook/reconciliation fallback path always record fee_amount as 0 even
  // though the buyer paid the fee, so that column alone undercounts. Every
  // paid ticket's total is subtotal * 1.05, so the fee is reconstructed from
  // the total itself instead, which holds regardless of which path created
  // the ticket.
  const FEE_PERCENTAGE = 0.05;
  const platformFeeRevenue = (soldTickets || []).reduce((acc, t) => {
    const total = t.total_amount_paid || 0;
    if (total <= 0) return acc;
    const subtotal = total / (1 + FEE_PERCENTAGE);
    return acc + (total - subtotal);
  }, 0);

  // What FlexPass actually keeps: the 5% charged to buyers minus what
  // Paystack itself deducts per transaction, which varies by payment
  // channel (bank transfer/USSD costs more than card) and isn't a fixed
  // percentage. De-duped by reference in case a charge got logged more than
  // once (e.g. both a live run and the historical backfill).
  const seenRefs = new Set<string>();
  let totalPaystackFees = 0;
  for (const row of paystackFeeRows || []) {
    const ref = row.reference;
    if (!ref || seenRefs.has(ref)) continue;
    seenRefs.add(ref);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalPaystackFees += (row.metadata as any)?.feesNaira || 0;
  }
  const netPlatformRevenue = platformFeeRevenue - totalPaystackFees;

  return NextResponse.json({
    totalUsers: totalUsers || 0,
    totalHosts: hostSet.size,
    verifiedHosts: verifiedHostSet.size,
    totalEvents: totalEvents || 0,
    totalTickets: (totalTickets || 0) + (scannedTickets || 0),
    scannedTickets: scannedTickets || 0,
    totalRevenue,
    platformFeeRevenue: Math.round(platformFeeRevenue),
    paystackFeesCost: Math.round(totalPaystackFees),
    netPlatformRevenue: Math.round(netPlatformRevenue),
    totalPaidOut,
    pendingPayouts: pendingPayoutRows?.length || 0,
    pendingPayoutAmount,
    pendingDeletes: pendingDeleteCount || 0,
  });
}
