import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeEventCapacity, computeEventPace, PaceStatus } from "@/lib/eventPacing";
import { platformFeeFromGross } from "@/lib/platformFee";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DAY_MS = 24 * 60 * 60 * 1000;

async function verifyAdmin(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

function rangeToDays(range: string): number | null {
  if (range === "7") return 7;
  if (range === "30") return 30;
  if (range === "90") return 90;
  return null; // "all"
}

interface TicketRow {
  id: string; event_id: string; user_email: string; user_gender: string | null;
  total_amount_paid: number | null; tier_id: string | null; referral_code: string | null;
  status: string; created_at: string;
}
interface TierRow { id: string; event_id: string; quantity_available: number | null; group_size: number | null }

export async function GET(request: Request) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30";
  const rangeDays = rangeToDays(range);
  const since = rangeDays ? new Date(Date.now() - rangeDays * DAY_MS).toISOString() : null;

  const [
    { data: events },
    { data: tiers },
    { data: allTickets },
    { data: paymentEvents },
  ] = await Promise.all([
    db.from("events").select("id, title, date, user_id, organizer_name, organizer_verified, total_tickets"),
    db.from("ticket_tiers").select("id, event_id, quantity_available, group_size"),
    db.from("tickets")
      .select("id, event_id, user_email, user_gender, total_amount_paid, tier_id, referral_code, status, created_at")
      .in("status", ["valid", "scanned"]),
    db.from("payment_events")
      .select("source, event_type, status, event_id, created_at")
      .or("source.eq.checkout-funnel,event_type.eq.ticket_created,event_type.eq.ticket_issued"),
  ]);

  const allEvents = events || [];
  const tierRows = (tiers || []) as TierRow[];
  const tickets = (allTickets || []) as TicketRow[];
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS).toISOString();

  const tiersByEvent = new Map<string, TierRow[]>();
  for (const t of tierRows) {
    if (!tiersByEvent.has(t.event_id)) tiersByEvent.set(t.event_id, []);
    tiersByEvent.get(t.event_id)!.push(t);
  }

  const ticketsByEvent = new Map<string, TicketRow[]>();
  for (const t of tickets) {
    if (!ticketsByEvent.has(t.event_id)) ticketsByEvent.set(t.event_id, []);
    ticketsByEvent.get(t.event_id)!.push(t);
  }

  const funnelByEvent = new Map<string, { opened: number; initiated: number; completed: number }>();
  for (const pe of paymentEvents || []) {
    if (!pe.event_id) continue;
    if (!funnelByEvent.has(pe.event_id)) funnelByEvent.set(pe.event_id, { opened: 0, initiated: 0, completed: 0 });
    const bucket = funnelByEvent.get(pe.event_id)!;
    if (pe.source === "checkout-funnel" && pe.event_type === "checkout_opened") bucket.opened++;
    else if (pe.source === "checkout-funnel" && pe.event_type === "checkout_initiated") bucket.initiated++;
    else if (pe.status === "success" && (pe.event_type === "ticket_created" || pe.event_type === "ticket_issued")) bucket.completed++;
  }

  // ---------- Per-event summaries (lifetime — powers Top Events + Top Hosts) ----------
  const eventSummaries = allEvents.map(ev => {
    const capacity = computeEventCapacity(tiersByEvent.get(ev.id) || [], ev.total_tickets);
    const evTickets = ticketsByEvent.get(ev.id) || [];
    const sold = evTickets.length;
    const revenue = evTickets.reduce((s, t) => s + (t.total_amount_paid || 0), 0);
    const velocity7d = evTickets.filter(t => t.created_at >= sevenDaysAgo).length;
    const velocityPrior7d = evTickets.filter(t => t.created_at >= fourteenDaysAgo && t.created_at < sevenDaysAgo).length;
    const daysUntilEvent = ev.date ? Math.ceil((new Date(ev.date).getTime() - now) / DAY_MS) : null;
    const pace: PaceStatus = computeEventPace({
      sold, capacity, velocity7d, velocityPrior7d,
      daysUntilEvent: daysUntilEvent !== null && daysUntilEvent >= 0 ? daysUntilEvent : null,
    });
    const fn = funnelByEvent.get(ev.id) || { opened: 0, initiated: 0, completed: 0 };
    const conversionPct = fn.initiated > 0 ? Math.round((fn.completed / fn.initiated) * 1000) / 10 : null;

    return {
      id: ev.id, title: ev.title, date: ev.date, userId: ev.user_id,
      hostName: ev.organizer_name || null, verified: !!ev.organizer_verified,
      sold, capacity, revenue, pace, conversionPct,
      checkoutInitiated: fn.initiated, checkoutCompleted: fn.completed,
    };
  });

  // ---------- Top events (by revenue) ----------
  const topEvents = [...eventSummaries]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(e => ({
      id: e.id, title: e.title, hostName: e.hostName || "—",
      pace: e.pace, sold: e.sold, capacity: e.capacity,
      conversionPct: e.conversionPct, revenue: e.revenue,
    }));

  // ---------- Top hosts (aggregate events by user_id, by revenue) ----------
  const hostAgg = new Map<string, {
    name: string | null; verified: boolean; events: number; revenue: number;
    feeEarned: number; initiated: number; completed: number;
  }>();
  for (const e of eventSummaries) {
    if (!e.userId) continue;
    if (!hostAgg.has(e.userId)) hostAgg.set(e.userId, { name: null, verified: false, events: 0, revenue: 0, feeEarned: 0, initiated: 0, completed: 0 });
    const h = hostAgg.get(e.userId)!;
    if (e.hostName && !h.name) h.name = e.hostName;
    if (e.verified) h.verified = true;
    h.events += 1;
    h.revenue += e.revenue;
    h.initiated += e.checkoutInitiated;
    h.completed += e.checkoutCompleted;
  }
  const eventOwner = new Map(allEvents.map(e => [e.id, e.user_id]));
  for (const t of tickets) {
    const userId = eventOwner.get(t.event_id);
    if (!userId || !hostAgg.has(userId)) continue;
    hostAgg.get(userId)!.feeEarned += platformFeeFromGross(t.total_amount_paid);
  }

  const totalHosts = hostAgg.size;
  const topHostEntries = [...hostAgg.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);

  // Resolve real host names/emails only for the handful shown, to avoid an
  // expensive full user list scan on every request.
  const resolvedNames = await Promise.all(topHostEntries.map(async ([userId, h]) => {
    if (h.name) return h.name;
    try {
      const { data } = await db.auth.admin.getUserById(userId);
      return data?.user?.email || `${userId.slice(0, 8)}…`;
    } catch { return `${userId.slice(0, 8)}…`; }
  }));

  const topHosts = topHostEntries.map(([userId, h], i) => ({
    userId, name: resolvedNames[i], verified: h.verified, events: h.events,
    revenue: h.revenue, feeEarned: Math.round(h.feeEarned),
    avgConversionPct: h.initiated > 0 ? Math.round((h.completed / h.initiated) * 1000) / 10 : null,
  }));

  // ---------- Range-scoped platform KPIs + momentum ----------
  const rangeTickets = since ? tickets.filter(t => t.created_at >= since) : tickets;
  const gmv = rangeTickets.reduce((s, t) => s + (t.total_amount_paid || 0), 0);

  const rangeFunnel = { opened: 0, initiated: 0, completed: 0 };
  for (const pe of paymentEvents || []) {
    if (since && pe.created_at < since) continue;
    if (pe.source === "checkout-funnel" && pe.event_type === "checkout_opened") rangeFunnel.opened++;
    else if (pe.source === "checkout-funnel" && pe.event_type === "checkout_initiated") rangeFunnel.initiated++;
    else if (pe.status === "success" && (pe.event_type === "ticket_created" || pe.event_type === "ticket_issued")) rangeFunnel.completed++;
  }
  const conversionPct = rangeFunnel.initiated > 0 ? Math.round((rangeFunnel.completed / rangeFunnel.initiated) * 1000) / 10 : null;
  const avgOrderValue = rangeFunnel.completed > 0 ? Math.round(gmv / rangeFunnel.completed) : (rangeTickets.length > 0 ? Math.round(gmv / rangeTickets.length) : 0);

  const activeHostIds = new Set<string>();
  for (const t of rangeTickets) {
    const userId = eventOwner.get(t.event_id);
    if (userId) activeHostIds.add(userId);
  }

  const momentumDays = rangeDays ?? 30;
  const momentumMap = new Map<string, number>();
  for (let i = momentumDays - 1; i >= 0; i--) {
    momentumMap.set(new Date(now - i * DAY_MS).toISOString().slice(0, 10), 0);
  }
  for (const t of tickets) {
    const d = t.created_at.slice(0, 10);
    if (momentumMap.has(d)) momentumMap.set(d, (momentumMap.get(d) || 0) + (t.total_amount_paid || 0));
  }
  const momentum = Array.from(momentumMap.entries()).map(([date, value]) => ({ date, value }));

  // ---------- Traffic sources — Direct vs. any promoter link, platform-wide ----------
  let directTickets = 0, directRevenue = 0, promoTickets = 0, promoRevenue = 0;
  for (const t of rangeTickets) {
    if (t.referral_code) { promoTickets++; promoRevenue += t.total_amount_paid || 0; }
    else { directTickets++; directRevenue += t.total_amount_paid || 0; }
  }
  const sources = [
    { name: "Direct / bio links", tickets: directTickets, revenue: directRevenue },
    { name: "Promoter links", tickets: promoTickets, revenue: promoRevenue },
  ];

  // ---------- Audience: gender split (lifetime, platform-wide) ----------
  let female = 0, male = 0, other = 0;
  for (const t of tickets) {
    const g = (t.user_gender || "").toLowerCase();
    if (g === "female") female++; else if (g === "male") male++; else other++;
  }
  const totalCounted = female + male + other;

  // ---------- Audience: new vs. returning buyers (lifetime, platform-wide) ----------
  const eventsByEmail = new Map<string, Set<string>>();
  for (const t of tickets) {
    if (!eventsByEmail.has(t.user_email)) eventsByEmail.set(t.user_email, new Set());
    eventsByEmail.get(t.user_email)!.add(t.event_id);
  }
  let returningBuyers = 0;
  const allBuyerEmails = new Set(tickets.map(t => t.user_email));
  for (const email of allBuyerEmails) {
    if ((eventsByEmail.get(email)?.size || 0) >= 2) returningBuyers++;
  }
  const totalBuyers = allBuyerEmails.size;
  const newPct = totalBuyers > 0 ? Math.round(((totalBuyers - returningBuyers) / totalBuyers) * 1000) / 10 : 0;
  const returningPct = totalBuyers > 0 ? Math.round((returningBuyers / totalBuyers) * 1000) / 10 : 0;

  // ---------- Audience: show-up rate (past events, platform-wide) ----------
  const pastEventIds = new Set(allEvents.filter(e => e.date && new Date(e.date).getTime() < now).map(e => e.id));
  const pastTickets = tickets.filter(t => pastEventIds.has(t.event_id));
  const showUpRate = pastTickets.length > 0
    ? { pct: Math.round((pastTickets.filter(t => t.status === "scanned").length / pastTickets.length) * 1000) / 10, sampleSize: pastTickets.length }
    : null;

  return NextResponse.json({
    range,
    kpis: {
      gmv, avgOrderValue, conversionPct,
      checkoutOpened: rangeFunnel.opened, checkoutInitiated: rangeFunnel.initiated, checkoutCompleted: rangeFunnel.completed,
      activeHosts: activeHostIds.size, totalHosts,
    },
    momentum,
    funnel: rangeFunnel,
    sources,
    topEvents,
    topHosts,
    audience: {
      gender: {
        female: totalCounted > 0 ? Math.round((female / totalCounted) * 1000) / 10 : 0,
        male: totalCounted > 0 ? Math.round((male / totalCounted) * 1000) / 10 : 0,
        other: totalCounted > 0 ? Math.round((other / totalCounted) * 1000) / 10 : 0,
        totalCounted,
      },
      newVsReturning: { newPct, returningPct, totalBuyers },
      showUpRate,
    },
  });
}
