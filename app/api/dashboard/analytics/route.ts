import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeEventCapacity, computeEventPace, PaceStatus } from "@/lib/eventPacing";

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

async function authenticate(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await authClient.auth.getUser(token);
  return user || null;
}

function rangeToDays(range: string): number | null {
  if (range === "7") return 7;
  if (range === "30") return 30;
  if (range === "90") return 90;
  return null; // "all"
}

interface TicketRow {
  id: string;
  event_id: string;
  user_email: string;
  user_gender: string | null;
  total_amount_paid: number | null;
  tier_id: string | null;
  tier_name: string | null;
  referral_code: string | null;
  status: string;
  created_at: string;
  checked_in_at: string | null;
}

interface TierRow {
  id: string;
  event_id: string;
  name: string;
  quantity_available: number | null;
  group_size: number | null;
  is_hidden: boolean | null;
}

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const eventIdParam = url.searchParams.get("eventId") || "all";
  const range = url.searchParams.get("range") || "30";
  const rangeDays = rangeToDays(range);
  const since = rangeDays ? new Date(Date.now() - rangeDays * DAY_MS).toISOString() : null;

  if (eventIdParam !== "all" && !UUID_RE.test(eventIdParam)) {
    return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
  }

  const { data: hostEvents } = await db
    .from("events")
    .select("id, title, date, total_tickets")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const allEvents = hostEvents || [];
  const allEventIds = allEvents.map(e => e.id);

  if (eventIdParam !== "all" && !allEventIds.includes(eventIdParam)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scopeEventIds = eventIdParam === "all" ? allEventIds : [eventIdParam];

  const empty = {
    scope: eventIdParam,
    range,
    events: [] as unknown[],
    kpis: {
      revenue: 0, ticketsSold: 0, capacity: 0, sellThroughPct: 0,
      checkoutOpened: 0, checkoutInitiated: 0, checkoutCompleted: 0, conversionPct: null as number | null,
      avgOrderValue: 0, pace: null as PaceStatus | null,
    },
    momentum: [] as { date: string; tickets: number }[],
    funnel: { opened: 0, initiated: 0, completed: 0 },
    sources: [] as { name: string; tickets: number; revenue: number }[],
    tiers: [] as { name: string; sold: number; capacity: number; revenue: number }[],
    audience: {
      gender: { female: 0, male: 0, other: 0, totalCounted: 0 },
      newVsReturning: { newPct: 0, returningPct: 0, totalBuyers: 0 },
      showUpRate: null as { pct: number; sampleSize: number } | null,
    },
  };

  if (allEventIds.length === 0) return NextResponse.json(empty);

  // One lifetime fetch of every ticket across every one of the host's
  // events — everything below derives either the full-host view (the
  // per-event table, used for chips/Needs Attention) or a scoped/range-
  // filtered slice of this same set (the KPIs/charts for what's selected),
  // so scope and table numbers can never drift apart.
  const [tiersRes, allTicketsRes, paymentEventsRes, promotersRes] = await Promise.all([
    db.from("ticket_tiers").select("id, event_id, name, quantity_available, group_size, is_hidden").in("event_id", allEventIds),
    db.from("tickets")
      .select("id, event_id, user_email, user_gender, total_amount_paid, tier_id, tier_name, referral_code, status, created_at, checked_in_at")
      .in("event_id", allEventIds).in("status", ["valid", "scanned"]),
    db.from("payment_events")
      .select("source, event_type, status, event_id, created_at")
      .in("event_id", allEventIds)
      .or("source.eq.checkout-funnel,event_type.eq.ticket_created,event_type.eq.ticket_issued"),
    db.from("event_promoters").select("id, event_id, name, code").in("event_id", allEventIds),
  ]);

  const tiers = (tiersRes.data || []) as TierRow[];
  const allTickets = (allTicketsRes.data || []) as TicketRow[];
  const paymentEvents = paymentEventsRes.data || [];
  const promoters = promotersRes.data || [];

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS).toISOString();

  const tiersByEvent = new Map<string, TierRow[]>();
  for (const t of tiers) {
    if (!tiersByEvent.has(t.event_id)) tiersByEvent.set(t.event_id, []);
    tiersByEvent.get(t.event_id)!.push(t);
  }

  const ticketsByEvent = new Map<string, TicketRow[]>();
  for (const t of allTickets) {
    if (!ticketsByEvent.has(t.event_id)) ticketsByEvent.set(t.event_id, []);
    ticketsByEvent.get(t.event_id)!.push(t);
  }

  const funnelByEvent = new Map<string, { opened: number; initiated: number; completed: number }>();
  for (const pe of paymentEvents) {
    if (!pe.event_id) continue;
    if (!funnelByEvent.has(pe.event_id)) funnelByEvent.set(pe.event_id, { opened: 0, initiated: 0, completed: 0 });
    const bucket = funnelByEvent.get(pe.event_id)!;
    if (pe.source === "checkout-funnel" && pe.event_type === "checkout_opened") bucket.opened++;
    else if (pe.source === "checkout-funnel" && pe.event_type === "checkout_initiated") bucket.initiated++;
    else if (pe.status === "success" && (pe.event_type === "ticket_created" || pe.event_type === "ticket_issued")) bucket.completed++;
  }

  // ---------- Per-event table (always lifetime, always every host event —
  // powers the comparison table, My Events chips, and Needs Attention) ----------
  const eventSummaries = allEvents.map(ev => {
    const capacity = computeEventCapacity(tiersByEvent.get(ev.id) || [], ev.total_tickets);
    const evTickets = ticketsByEvent.get(ev.id) || [];
    const sold = evTickets.length;
    const revenue = evTickets.reduce((s, t) => s + (t.total_amount_paid || 0), 0);
    const velocity7d = evTickets.filter(t => t.created_at >= sevenDaysAgo).length;
    const velocityPrior7d = evTickets.filter(t => t.created_at >= fourteenDaysAgo && t.created_at < sevenDaysAgo).length;
    const daysUntilEvent = ev.date ? Math.ceil((new Date(ev.date).getTime() - now) / DAY_MS) : null;
    const pace = computeEventPace({
      sold, capacity, velocity7d, velocityPrior7d,
      daysUntilEvent: daysUntilEvent !== null && daysUntilEvent >= 0 ? daysUntilEvent : null,
    });
    const fn = funnelByEvent.get(ev.id) || { opened: 0, initiated: 0, completed: 0 };
    const conversionPct = fn.initiated > 0 ? Math.round((fn.completed / fn.initiated) * 1000) / 10 : null;

    return {
      id: ev.id, title: ev.title, date: ev.date,
      sold, capacity,
      sellThroughPct: capacity > 0 ? Math.round((sold / capacity) * 1000) / 10 : 0,
      revenue, pace, velocity7d, velocityPrior7d,
      daysUntilEvent: daysUntilEvent !== null && daysUntilEvent >= 0 ? daysUntilEvent : null,
      checkoutInitiated: fn.initiated, checkoutCompleted: fn.completed, conversionPct,
    };
  });

  // ---------- Scoped slice (the selected event, or all) for KPIs/charts ----------
  const scopeTickets = allTickets.filter(t => scopeEventIds.includes(t.event_id));
  const rangeTickets = since ? scopeTickets.filter(t => t.created_at >= since) : scopeTickets;
  const revenue = rangeTickets.reduce((s, t) => s + (t.total_amount_paid || 0), 0);
  const ticketsSold = rangeTickets.length;

  const scopeCapacity = scopeEventIds.reduce((sum, id) => {
    const ev = allEvents.find(e => e.id === id);
    return sum + computeEventCapacity(tiersByEvent.get(id) || [], ev?.total_tickets);
  }, 0);
  const scopeSoldLifetime = scopeTickets.length;

  const rangeFunnel = { opened: 0, initiated: 0, completed: 0 };
  for (const pe of paymentEvents) {
    if (!pe.event_id || !scopeEventIds.includes(pe.event_id)) continue;
    if (since && pe.created_at < since) continue;
    if (pe.source === "checkout-funnel" && pe.event_type === "checkout_opened") rangeFunnel.opened++;
    else if (pe.source === "checkout-funnel" && pe.event_type === "checkout_initiated") rangeFunnel.initiated++;
    else if (pe.status === "success" && (pe.event_type === "ticket_created" || pe.event_type === "ticket_issued")) rangeFunnel.completed++;
  }
  const conversionPct = rangeFunnel.initiated > 0 ? Math.round((rangeFunnel.completed / rangeFunnel.initiated) * 1000) / 10 : null;
  const avgOrderValue = rangeFunnel.completed > 0 ? Math.round(revenue / rangeFunnel.completed) : (ticketsSold > 0 ? Math.round(revenue / ticketsSold) : 0);

  const pace: PaceStatus | null = eventIdParam !== "all"
    ? (eventSummaries.find(e => e.id === eventIdParam)?.pace ?? null)
    : null;

  // Momentum — daily tickets sold, bucketed over the range (defaults to 30
  // days of history when range is "all" so the chart has a sane width).
  const momentumDays = rangeDays ?? 30;
  const momentumMap = new Map<string, number>();
  for (let i = momentumDays - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    momentumMap.set(d, 0);
  }
  for (const t of scopeTickets) {
    const d = t.created_at.slice(0, 10);
    if (momentumMap.has(d)) momentumMap.set(d, (momentumMap.get(d) || 0) + 1);
  }
  const momentum = Array.from(momentumMap.entries()).map(([date, tickets]) => ({ date, tickets }));

  // ---------- Traffic sources — Direct vs. each promoter, by name ----------
  const scopePromoters = promoters.filter(p => scopeEventIds.includes(p.event_id));
  const codeToName = new Map(scopePromoters.map(p => [p.code, p.name]));
  const sourceMap = new Map<string, { tickets: number; revenue: number }>();
  let directTickets = 0, directRevenue = 0;
  for (const t of rangeTickets) {
    const name = t.referral_code ? codeToName.get(t.referral_code) : null;
    if (!name) { directTickets++; directRevenue += t.total_amount_paid || 0; continue; }
    if (!sourceMap.has(name)) sourceMap.set(name, { tickets: 0, revenue: 0 });
    const bucket = sourceMap.get(name)!;
    bucket.tickets++; bucket.revenue += t.total_amount_paid || 0;
  }
  const sources = [
    ...(directTickets > 0 ? [{ name: "Direct / bio link", tickets: directTickets, revenue: directRevenue }] : []),
    ...Array.from(sourceMap.entries()).map(([name, v]) => ({ name, tickets: v.tickets, revenue: v.revenue })),
  ].sort((a, b) => b.tickets - a.tickets);

  // ---------- Tier performance — only meaningful for a single event ----------
  let tierPerf: { name: string; sold: number; capacity: number; revenue: number }[] = [];
  if (eventIdParam !== "all") {
    const evTiers = tiersByEvent.get(eventIdParam) || [];
    tierPerf = evTiers.map(tier => {
      const tierTickets = scopeTickets.filter(t => t.tier_id === tier.id);
      return {
        name: tier.name,
        sold: tierTickets.length,
        capacity: (tier.quantity_available || 0) * (tier.group_size || 1),
        revenue: tierTickets.reduce((s, t) => s + (t.total_amount_paid || 0), 0),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  // ---------- Audience: gender split ----------
  let female = 0, male = 0, other = 0;
  for (const t of scopeTickets) {
    const g = (t.user_gender || "").toLowerCase();
    if (g === "female") female++;
    else if (g === "male") male++;
    else other++;
  }
  const totalCounted = female + male + other;

  // ---------- Audience: new vs. returning buyers (host-wide loyalty) ----------
  const eventsByEmail = new Map<string, Set<string>>();
  for (const t of allTickets) {
    if (!eventsByEmail.has(t.user_email)) eventsByEmail.set(t.user_email, new Set());
    eventsByEmail.get(t.user_email)!.add(t.event_id);
  }
  const scopeBuyerEmails = new Set(scopeTickets.map(t => t.user_email));
  let returningBuyers = 0;
  for (const email of scopeBuyerEmails) {
    if ((eventsByEmail.get(email)?.size || 0) >= 2) returningBuyers++;
  }
  const totalBuyers = scopeBuyerEmails.size;
  const newPct = totalBuyers > 0 ? Math.round(((totalBuyers - returningBuyers) / totalBuyers) * 1000) / 10 : 0;
  const returningPct = totalBuyers > 0 ? Math.round((returningBuyers / totalBuyers) * 1000) / 10 : 0;

  // ---------- Audience: show-up rate (past events in scope only) ----------
  const pastEventIds = new Set(
    allEvents.filter(e => scopeEventIds.includes(e.id) && e.date && new Date(e.date).getTime() < now).map(e => e.id)
  );
  const pastTickets = scopeTickets.filter(t => pastEventIds.has(t.event_id));
  const showUpRate = pastTickets.length > 0
    ? { pct: Math.round((pastTickets.filter(t => t.status === "scanned").length / pastTickets.length) * 1000) / 10, sampleSize: pastTickets.length }
    : null;

  return NextResponse.json({
    scope: eventIdParam,
    range,
    events: eventSummaries,
    kpis: {
      revenue, ticketsSold, capacity: scopeCapacity,
      sellThroughPct: scopeCapacity > 0 ? Math.round((scopeSoldLifetime / scopeCapacity) * 1000) / 10 : 0,
      checkoutOpened: rangeFunnel.opened, checkoutInitiated: rangeFunnel.initiated, checkoutCompleted: rangeFunnel.completed,
      conversionPct, avgOrderValue, pace,
    },
    momentum,
    funnel: rangeFunnel,
    sources,
    tiers: tierPerf,
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
