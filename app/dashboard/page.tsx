"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2, DollarSign, Ticket, Users, Calendar, Edit, Download, Plus, Mail, TrendingUp, BadgeCheck, BookOpen, X, ChevronRight,
  Percent, ArrowUpRight, AlertTriangle, Wallet, PartyPopper,
} from "lucide-react";
import { Toast, ToastState, ToastType } from "@/components/Toast";
import Link from "next/link";
import { csvCell, downloadCSV } from "@/lib/exportCsv";
import { hostAmount } from "@/lib/hostAmount";
import { splitName } from "@/lib/splitName";
import EventPaceChip from "@/components/EventPaceChip";
import { PaceStatus } from "@/lib/eventPacing";

interface AttentionItem {
  id: string;
  tone: "warn" | "good" | "info";
  icon: ReactNode;
  title: string;
  text: string;
  ctaLabel: string;
  onClick: () => void;
  /** Set for items whose CTA triggers an async action (e.g. duplicate) so the
   *  button can show a loading state without the item itself going stale. */
  relatedEventId?: string;
}

const ATTENTION_STYLES: Record<AttentionItem["tone"], { bg: string; color: string }> = {
  warn: { bg: "rgba(250,178,25,0.16)", color: "#b9740a" },
  good: { bg: "rgba(22,163,74,0.12)", color: "#16a34a" },
  info: { bg: "rgba(159,103,254,0.12)", color: "var(--brand-indigo)" },
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    setToast({ message, type });
  }, []);
  const [stats, setStats] = useState<{
    revenue: number; ticketsSold: number; activeEvents: number;
    recentSales: any[]; myEvents: any[];
  }>({ revenue: 0, ticketsSold: 0, activeEvents: 0, recentSales: [], myEvents: [] });
  const [paceByEvent, setPaceByEvent] = useState<Record<string, PaceStatus>>({});
  const [checkoutStats, setCheckoutStats] = useState<{ conversionPct: number | null; completed: number; initiated: number }>({ conversionPct: null, completed: 0, initiated: 0 });
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // Primary: explicitly fetch session (works reliably after page reload)
    const checkSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUser(session.user);
        loadDashboardData(session.user.id);
      });
    };

    checkSession();

    // Also listen for sign-out so the page reacts if user logs out in another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.replace("/login");
      }
    });

    // Safari (and other browsers) can restore this page from the
    // back/forward cache after sign-out without re-running this effect —
    // re-verify the session so a bfcache restore can't show stale
    // authenticated content for a signed-out user.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkSession();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboardData(userId: string) {
    try {
      const { data: myEvents } = await supabase
        .from("events").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!myEvents || myEvents.length === 0) {
        setStats({ revenue: 0, ticketsSold: 0, activeEvents: 0, recentSales: [], myEvents: [] });
        setLoading(false);
        return;
      }

      const myEventIds = myEvents.map(e => e.id);
      // valid + scanned — a checked-in ticket is still a completed sale;
      // excluding it would silently undercount revenue for any event
      // that's already had check-in (matches Wallet's and Admin's balance math).
      const { data: myTickets } = await supabase
        .from("tickets").select("*, events(title, price)")
        .in("event_id", myEventIds).in("status", ["valid", "scanned"])
        .order("created_at", { ascending: false });

      const revenue = myTickets?.reduce((acc, t) => acc + hostAmount(t), 0) || 0;

      // Sales velocity: tickets sold per event in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const velocityMap = new Map<string, number>();
      myTickets?.forEach(t => {
        if (t.created_at >= sevenDaysAgo) {
          velocityMap.set(t.event_id, (velocityMap.get(t.event_id) || 0) + 1);
        }
      });

      // Ticket count per event (total)
      const soldByEvent = new Map<string, number>();
      myTickets?.forEach(t => {
        soldByEvent.set(t.event_id, (soldByEvent.get(t.event_id) || 0) + 1);
      });

      // Attach velocity + sold count to each event
      const eventsWithVelocity = myEvents.map(e => ({
        ...e,
        _sold: soldByEvent.get(e.id) || 0,
        _velocity7d: velocityMap.get(e.id) || 0,
      }));

      setStats({
        revenue,
        ticketsSold: myTickets?.length || 0,
        activeEvents: myEvents.length,
        recentSales: myTickets || [],
        myEvents: eventsWithVelocity,
      });

      // Everything below is best-effort context for the KPI strip and Needs
      // Attention — none of it should block the core numbers above from showing.
      loadAttentionData(myEvents);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttentionData(myEvents: any[]) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [analyticsRes, payoutsRes] = await Promise.all([
        fetch("/api/dashboard/analytics?eventId=all&range=30", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.from("payouts").select("amount, status").eq("user_id", session.user.id),
      ]);

      const items: AttentionItem[] = [];
      let events: any[] = [];

      if (analyticsRes.ok) {
        const analytics = await analyticsRes.json();
        events = analytics.events || [];

        const pace: Record<string, PaceStatus> = {};
        events.forEach((e: any) => { pace[e.id] = e.pace; });
        setPaceByEvent(pace);
        setCheckoutStats({
          conversionPct: analytics.kpis?.conversionPct ?? null,
          completed: analytics.kpis?.checkoutCompleted || 0,
          initiated: analytics.kpis?.checkoutInitiated || 0,
        });

        // Slowing event: needs a push, ranked by lowest sell-through.
        const needsPush = events.filter((e: any) => e.pace === "needs_push").sort((a: any, b: any) => a.sellThroughPct - b.sellThroughPct)[0];
        if (needsPush) {
          items.push({
            id: `slow-${needsPush.id}`, tone: "warn", icon: <AlertTriangle size={16} />,
            title: `${needsPush.title} is slowing down`,
            text: `Only ${needsPush.sellThroughPct}% sold${needsPush.daysUntilEvent !== null ? ` with ${needsPush.daysUntilEvent} day${needsPush.daysUntilEvent === 1 ? "" : "s"} to go` : ""} — sales have dropped this week.`,
            ctaLabel: "Boost this event", onClick: () => router.push(`/dashboard/events/${needsPush.id}/edit`),
          });
        }

        // High checkout drop-off vs. the host's own average, min sample size.
        const withSample = events.filter((e: any) => e.checkoutInitiated >= 8 && e.conversionPct !== null);
        if (withSample.length >= 2) {
          const avgConv = withSample.reduce((s: number, e: any) => s + e.conversionPct, 0) / withSample.length;
          const worst = [...withSample].sort((a: any, b: any) => a.conversionPct - b.conversionPct)[0];
          if (avgConv - worst.conversionPct >= 15) {
            items.push({
              id: `dropoff-${worst.id}`, tone: "warn", icon: <AlertTriangle size={16} />,
              title: `High checkout drop-off on ${worst.title}`,
              text: `${100 - worst.conversionPct}% of buyers abandon before paying — ${Math.round(avgConv - worst.conversionPct)} points below your other events.`,
              ctaLabel: "View funnel", onClick: () => router.push(`/dashboard/analytics?eventId=${worst.id}`),
            });
          }
        }

        // Sold-out opportunity.
        const soldOut = events.find((e: any) => e.pace === "sold_out");
        if (soldOut) {
          items.push({
            id: `soldout-${soldOut.id}`, tone: "good", icon: <PartyPopper size={16} />,
            title: `${soldOut.title} sold out`,
            text: "Demand is proven — duplicate it to plan your next drop while it's hot.",
            ctaLabel: "Duplicate event", relatedEventId: soldOut.id,
            onClick: () => handleDuplicate(soldOut.id),
          });
        }
      }

      if (!payoutsRes.error) {
        const payouts = payoutsRes.data || [];
        const totalWithdrawn = payouts.filter((p: any) => p.status !== "rejected").reduce((s: number, p: any) => s + p.amount, 0);
        const { data: allHostTickets } = await supabase
          .from("tickets").select("total_amount_paid, events(price)")
          .in("event_id", myEvents.map(e => e.id)).in("status", ["valid", "scanned"]);
        const totalRevenue = (allHostTickets || []).reduce((s: number, t: any) => s + hostAmount(t), 0);
        const balance = Math.max(0, totalRevenue - totalWithdrawn);
        if (balance >= 5000) {
          items.push({
            id: "payout-ready", tone: "info", icon: <Wallet size={16} />,
            title: `₦${balance.toLocaleString()} ready to withdraw`,
            text: "Your available balance is sitting in your wallet, ready to send to your bank.",
            ctaLabel: "Go to Wallet", onClick: () => router.push("/dashboard/wallet"),
          });
        }
      }

      setAttention(items);
    } catch (err) {
      console.error("Needs Attention load error:", err);
    }
  }

  async function handleDuplicate(eventId: string) {
    setDuplicatingId(eventId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/duplicate-event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (res.ok && data.newEventId) {
        router.push(`/dashboard/events/${data.newEventId}/edit`);
      } else {
        showToast(data.error || "Failed to duplicate event", "error");
        setDuplicatingId(null);
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
      setDuplicatingId(null);
    }
  }

  const handleExport = () => {
    if (!stats.recentSales.length) { showToast("No data to export yet", "warning"); return; }

    // Group tickets by event ID (not title) so the CSV reads as one section
    // per event with its own subtotal — grouping by title alone would merge
    // separate events that happen to share a name (e.g. a recurring host's
    // repeat editions of the same event) into a single blended section.
    const grouped = new Map<string, typeof stats.recentSales>();
    for (const t of stats.recentSales) {
      const id = t.event_id || "unknown";
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id)!.push(t);
    }
    const labelFor = (id: string, tickets: typeof stats.recentSales) => {
      const title = tickets[0]?.events?.title || "Unknown";
      const event = stats.myEvents.find((e: any) => e.id === id);
      const date = event?.date ? new Date(event.date).toLocaleDateString("en-NG") : null;
      return date ? `${title} (${date})` : title;
    };
    const sortedIds = Array.from(grouped.keys()).sort((a, b) =>
      labelFor(a, grouped.get(a)!).localeCompare(labelFor(b, grouped.get(b)!))
    );

    const header = ["Event", "Ticket ID", "Tier", "First Name", "Last Name", "Email", "Amount (NGN)", "Status", "Date"];
    const rows: string[][] = [header];
    let grandTotal = 0;
    let grandCount = 0;

    for (const id of sortedIds) {
      const label = labelFor(id, grouped.get(id)!);
      const eventTickets = [...grouped.get(id)!].sort((a, b) => a.created_at.localeCompare(b.created_at));
      let subtotal = 0;
      for (const t of eventTickets) {
        const amount = hostAmount(t);
        subtotal += amount;
        const { firstName, lastName } = splitName(t.user_name);
        rows.push([
          csvCell(label),
          csvCell(t.id),
          csvCell(t.tier_name || "Standard"),
          csvCell(firstName || "N/A"),
          csvCell(lastName),
          csvCell(t.user_email),
          csvCell(amount),
          csvCell(t.status),
          csvCell(new Date(t.created_at).toLocaleDateString("en-NG")),
        ]);
      }
      rows.push(["", "", "", "", "", `Subtotal (${eventTickets.length} ticket${eventTickets.length === 1 ? "" : "s"})`, csvCell(subtotal), "", ""]);
      rows.push(["", "", "", "", "", "", "", "", ""]);
      grandTotal += subtotal;
      grandCount += eventTickets.length;
    }
    rows.push(["", "", "", "", "", `GRAND TOTAL (${grandCount} ticket${grandCount === 1 ? "" : "s"})`, csvCell(grandTotal), "", ""]);

    downloadCSV(rows, `flexpass_all_events_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleExportByEvent = async (eventId: string, eventTitle: string) => {
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select("*, events(title, price)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error || !tickets?.length) {
      showToast("No ticket data for this event yet", "warning");
      return;
    }

    const header = ["Ticket ID", "Tier", "First Name", "Last Name", "Email", "Amount (NGN)", "Status", "Date"];
    const rows = tickets.map((t: any) => {
      const { firstName, lastName } = splitName(t.user_name);
      return [
        csvCell(t.id),
        csvCell(t.tier_name || "Standard"),
        csvCell(firstName || "N/A"),
        csvCell(lastName),
        csvCell(t.user_email),
        csvCell(hostAmount(t)),
        csvCell(t.status),
        csvCell(new Date(t.created_at).toLocaleDateString("en-NG")),
      ];
    });
    const safe = eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadCSV([header, ...rows], `flexpass_${safe}_${new Date().toISOString().split("T")[0]}.csv`);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#480082]" />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading your dashboard…</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-theme">Dashboard Overview</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-theme-2 text-sm truncate max-w-[200px] sm:max-w-none">{user?.email}</p>
            {stats.myEvents.some((e: any) => e.organizer_verified) && (
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                <BadgeCheck size={12} /> Verified Host
              </span>
            )}
          </div>
        </div>
        <Link href="/create" className="shrink-0">
          <button className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm text-white hover:opacity-90 transition"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            <Plus size={16} /> <span className="hidden sm:inline">New Event</span><span className="sm:hidden">New</span>
          </button>
        </Link>
      </div>

      {/* ── Creator Guide welcome banner ── */}
      {!guideDismissed && (
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(72,0,130,0.25)" }}
        >
          {/* Gradient background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, rgba(72,0,130,0.08) 0%, rgba(159,103,254,0.05) 50%, rgba(255,183,0,0.05) 100%)" }}
          />
          <div className="relative z-10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #480082, #9F67FE)" }}
            >
              <BookOpen size={22} className="text-white" />
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  New to FlexPass? Read the Creator Guide
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255,183,0,0.15)", color: "#FFB700" }}
                >
                  Recommended
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Video walkthroughs and step-by-step instructions for creating events, managing promoters, running check-in, and getting paid.
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/dashboard/guide"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
                style={{ backgroundColor: "var(--brand-indigo)" }}
              >
                Open Guide <ChevronRight size={14} />
              </Link>
              <button
                onClick={() => setGuideDismissed(true)}
                className="p-2 rounded-xl transition-colors hover:bg-black/5"
                style={{ color: "var(--text-muted)" }}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { icon: <DollarSign className="h-6 w-6 text-green-600"/>, bg: "bg-green-100", label: "Total Revenue", value: `₦${stats.revenue.toLocaleString()}` },
          { icon: <Ticket className="h-6 w-6 text-[#480082]"/>, bg: "bg-[#480082]/10", label: "Tickets Sold", value: stats.ticketsSold },
          { icon: <Users className="h-6 w-6 text-amber-600"/>, bg: "bg-amber-100", label: "Your Events", value: stats.activeEvents },
        ].map(s => (
          <div key={s.label} className="p-4 sm:p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className={`p-2 ${s.bg} rounded-lg w-fit mb-3 sm:mb-4`}>{s.icon}</div>
            <p className="text-theme-2 text-xs sm:text-sm">{s.label}</p>
            <h3 className="text-xl sm:text-3xl font-bold text-theme mt-1 truncate">{s.value}</h3>
          </div>
        ))}
        <div className="p-4 sm:p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="p-2 rounded-lg w-fit" style={{ backgroundColor: "rgba(159,103,254,0.12)" }}><Percent className="h-6 w-6" style={{ color: "var(--brand-indigo)" }} /></div>
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(159,103,254,0.14)", color: "var(--brand-indigo)" }}>New</span>
          </div>
          <p className="text-theme-2 text-xs sm:text-sm">Checkout Completion</p>
          <h3 className="text-xl sm:text-3xl font-bold text-theme mt-1 truncate">
            {checkoutStats.conversionPct !== null ? `${checkoutStats.conversionPct}%` : "—"}
          </h3>
          <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs font-bold mt-2" style={{ color: "var(--brand-indigo)" }}>
            See funnel <ArrowUpRight size={11} />
          </Link>
        </div>
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-base text-theme">Needs your attention</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(250,178,25,0.16)", color: "#b9740a" }}>{attention.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attention.map(item => {
              const style = ATTENTION_STYLES[item.tone];
              const isDuplicating = !!item.relatedEventId && duplicatingId === item.relatedEventId;
              return (
                <div key={item.id} className="relative flex gap-3 p-4 rounded-2xl overflow-hidden shadow-sm"
                  style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: style.color }} />
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: style.bg, color: style.color }}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-theme">{item.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed text-theme-2">{item.text}</p>
                    <button
                      onClick={item.onClick}
                      disabled={isDuplicating}
                      className="inline-flex items-center gap-1 text-xs font-bold mt-2 disabled:opacity-60"
                      style={{ color: style.color }}
                    >
                      {isDuplicating ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                      {isDuplicating ? "Duplicating…" : item.ctaLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.myEvents.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--card-bg)", border: "2px dashed var(--card-border)" }}>
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(72,0,130,0.08)" }}>
            <Plus className="h-8 w-8" style={{ color: "var(--brand-indigo)" }} />
          </div>
          <h3 className="text-xl font-bold mb-2 text-theme">Create your first event</h3>
          <p className="text-theme-2 text-sm mb-6 max-w-sm mx-auto">Start selling tickets in minutes. Set up tiers, share your link, get paid automatically.</p>
          <Link href="/create">
            <button className="px-8 py-3 rounded-xl font-bold text-white hover:opacity-90 transition" style={{ backgroundColor: "var(--brand-indigo)" }}>
              Create Event
            </button>
          </Link>
        </div>
      )}

      {/* My Events */}
      {stats.myEvents.length > 0 && (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-6" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <h3 className="font-bold text-lg text-theme">My Events</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {stats.myEvents.map((event: any) => {
              const daily = (event._velocity7d / 7).toFixed(1);
              const showVelocity = event._velocity7d > 0;
              return (
                <div key={event.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--surface-raised)] transition">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                      {event.image_url && <img src={event.image_url} alt={event.title} className="object-cover w-full h-full" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-theme truncate text-sm sm:text-base">{event.title}</h4>
                        {paceByEvent[event.id] && <EventPaceChip status={paceByEvent[event.id]} size="xs" />}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-theme-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(event.date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Ticket size={11} /> {event._sold} sold</span>
                        {showVelocity && (
                          <span className="hidden sm:flex items-center gap-1 font-semibold" style={{ color: "var(--brand-lavender)" }}>
                            <TrendingUp size={11} /> {daily}/day (7d)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link href={`/dashboard/events/${event.id}/email`}
                      className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                      title="Email attendees">
                      <Mail size={13} /> <span className="hidden sm:inline">Email</span>
                    </Link>
                    <button onClick={() => handleExportByEvent(event.id, event.title)}
                      className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                      title="Export CSV">
                      <Download size={13} /> <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button onClick={() => router.push(`/dashboard/events/${event.id}/edit`)}
                      className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                      title="Edit event">
                      <Edit size={13} /> <span className="hidden sm:inline">Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {stats.recentSales.length > 0 && (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <h3 className="font-bold text-base sm:text-lg text-theme">Recent Transactions</h3>
            <button onClick={handleExport} className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
              <Download size={14} /> <span className="hidden sm:inline">Export </span>CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase font-medium" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>
                <tr>
                  <th className="px-4 sm:px-6 py-3">Event</th>
                  <th className="hidden sm:table-cell px-6 py-3">Customer</th>
                  <th className="hidden md:table-cell px-6 py-3">Date</th>
                  <th className="px-4 sm:px-6 py-3">Amount</th>
                  <th className="px-4 sm:px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody style={{ color: "var(--text-secondary)" }}>
                {stats.recentSales.slice(0, 5).map(ticket => (
                  <tr key={ticket.id} className="border-t hover:bg-[var(--surface-raised)] transition" style={{ borderColor: "var(--card-border)" }}>
                    <td className="px-4 sm:px-6 py-3 font-medium text-theme max-w-[120px] sm:max-w-none truncate">{ticket.events?.title || "Unknown"}</td>
                    <td className="hidden sm:table-cell px-6 py-3 max-w-[160px] truncate">{ticket.user_email}</td>
                    <td className="hidden md:table-cell px-6 py-3">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td className="px-4 sm:px-6 py-3 font-bold whitespace-nowrap">₦{hostAmount(ticket).toLocaleString()}</td>
                    <td className="px-4 sm:px-6 py-3"><span className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Paid</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
