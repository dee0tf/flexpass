"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Building2,
  Users, Ticket, TrendingUp, Clock, AlertCircle, Trash2, BadgeCheck, ShieldOff,
  ScanLine, ArrowDownToLine, CalendarDays, ChevronDown, ChevronUp, CreditCard, Share2,
  Download, LogOut, Percent,
} from "lucide-react";
import Logo from "@/components/Logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { csvCell, downloadCSV } from "@/lib/exportCsv";
import { splitName } from "@/lib/splitName";
import EventPaceChip from "@/components/EventPaceChip";
import MomentumChart from "@/components/analytics/MomentumChart";
import FunnelBars from "@/components/analytics/FunnelBars";
import GenderDonut from "@/components/analytics/GenderDonut";
import { PaceStatus } from "@/lib/eventPacing";

type Payout = {
  id: string; amount: number; status: string; created_at: string;
  transfer_code: string | null; user_id: string; user_email: string;
  bank_accounts: { bank_name: string; account_number: string; account_name: string } | null;
};

type DeleteRequest = {
  id: string; event_id: string; event_title: string;
  reason: string; status: string; created_at: string;
  user_id: string; user_email: string;
  event_exists: boolean;
};

type Stats = {
  totalUsers: number; totalHosts: number; verifiedHosts: number;
  totalEvents: number; totalTickets: number; scannedTickets: number;
  totalRevenue: number; platformFeeRevenue: number;
  paystackFeesCost: number; netPlatformRevenue: number; totalPaidOut: number;
  pendingPayouts: number; pendingPayoutAmount: number;
  pendingDeletes: number;
  checkoutInitiated: number; completedCheckouts: number;
  checkoutCompletionRate: number | null;
};

type Host = {
  user_id: string; email: string; organizer_name: string;
  events: number; tickets: number; revenue: number; fee: number; verified: boolean;
  promoters: number;
  bank: { bank_name: string; account_number: string; account_name: string } | null;
};

type AdminEvent = {
  id: string; title: string; date: string; image_url: string | null;
  organizer_name: string; verified: boolean;
  host_email: string; tickets: number; revenue: number; fee: number;
};

type AdminTicket = {
  id: string; user_name: string; user_email: string;
  tier_name: string | null; total_amount_paid: number;
  status: string; created_at: string; referral_code: string | null;
  checked_in_at: string | null;
};

type AdminAnalytics = {
  range: string;
  kpis: {
    gmv: number; avgOrderValue: number; conversionPct: number | null;
    checkoutOpened: number; checkoutInitiated: number; checkoutCompleted: number;
    activeHosts: number; totalHosts: number;
  };
  momentum: { date: string; value: number }[];
  funnel: { opened: number; initiated: number; completed: number };
  sources: { name: string; tickets: number; revenue: number }[];
  topEvents: {
    id: string; title: string; hostName: string; pace: PaceStatus;
    sold: number; capacity: number; conversionPct: number | null; revenue: number;
  }[];
  topHosts: {
    userId: string; name: string; verified: boolean; events: number;
    revenue: number; feeEarned: number; avgConversionPct: number | null;
  }[];
  audience: {
    gender: { female: number; male: number; other: number; totalCounted: number };
    newVsReturning: { newPct: number; returningPct: number; totalBuyers: number };
    showUpRate: { pct: number; sampleSize: number } | null;
  };
};

type AnalyticsRange = "7" | "30" | "90" | "all";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [payoutTab, setPayoutTab] = useState<"pending" | "all">("pending");
  const [deleteTab, setDeleteTab] = useState<"pending" | "approved" | "all">("pending");
  const [mainTab, setMainTab] = useState<"withdrawals" | "deletes" | "hosts" | "events" | "analytics">("withdrawals");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventTickets, setEventTickets] = useState<Record<string, AdminTicket[]>>({});
  const [eventTicketsLoading, setEventTicketsLoading] = useState<string | null>(null);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("30");

  useEffect(() => {
    const checkAuth = () => {
      setLoading(true);
      setAuthorized(false);
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) { setLoading(false); return; }
        const res = await fetch("/api/admin/check-auth", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) { setLoading(false); return; }
        setAuthorized(true);
        loadData();
      });
    };

    checkAuth();

    // Safari (and other browsers) can restore this page from the
    // back/forward cache after sign-out without re-running this effect —
    // re-verify the session so a bfcache restore can't show stale
    // authorized content for a signed-out user.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkAuth();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  async function loadData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      const [payoutsRes, deletesRes, statsRes] = await Promise.all([
        fetch("/api/admin/payouts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/delete-requests", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (payoutsRes.ok) {
        const d = await payoutsRes.json();
        setPayouts(d.payouts || []);
      }
      if (deletesRes.ok) {
        const d = await deletesRes.json();
        setDeleteRequests(d.requests || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePayoutAction(payoutId: string, action: "approve" | "reject" | "mark_paid") {
    setProcessing(payoutId + action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/process-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ payout_id: payoutId, action }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "Something went wrong.", "error");
      else {
        showToast(data.message, "success");
        const nextStatus = action === "approve" ? "processing" : action === "mark_paid" ? "paid" : "rejected";
        setPayouts(prev => prev.map(p =>
          p.id === payoutId ? { ...p, status: nextStatus } : p
        ));
        loadData();
      }
    } finally { setProcessing(null); }
  }

  async function loadHosts() {
    setHostsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/hosts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setHosts(data.hosts || []);
    } finally { setHostsLoading(false); }
  }

  async function loadEvents() {
    setEventsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/events", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAdminEvents(data.events || []);
      } else {
        console.error("[admin] events API error:", data.error);
        showToast("Failed to load events: " + (data.error || "unknown error"), "error");
      }
    } finally { setEventsLoading(false); }
  }

  async function loadEventTickets(eventId: string) {
    if (eventTickets[eventId]) return; // already loaded
    setEventTicketsLoading(eventId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/events?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setEventTickets(prev => ({ ...prev, [eventId]: data.tickets || [] }));
    } finally { setEventTicketsLoading(null); }
  }

  async function loadAdminAnalytics(range: AnalyticsRange) {
    setAnalyticsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setAdminAnalytics(await res.json());
    } finally { setAnalyticsLoading(false); }
  }

  function toggleEvent(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(eventId);
      loadEventTickets(eventId);
    }
  }

  // Group a buyer list by ticket tier so admins see holders clustered by
  // what they bought, not just a flat chronological list.
  function groupByTier(tickets: AdminTicket[]) {
    const groups = new Map<string, AdminTicket[]>();
    for (const t of tickets) {
      const tier = t.tier_name || "Standard";
      if (!groups.has(tier)) groups.set(tier, []);
      groups.get(tier)!.push(t);
    }
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  function handleExportEventCsv(eventTitle: string, buyers: AdminTicket[]) {
    if (!buyers.length) return;
    const groups = groupByTier(buyers);

    const header = ["Tier", "First Name", "Last Name", "Email", "Amount (NGN)", "Via Promoter", "Status", "Date", "Checked In At"];
    const rows: string[][] = [header];
    let grandTotal = 0;

    for (const [tierName, tierTickets] of groups) {
      let subtotal = 0;
      for (const t of tierTickets) {
        subtotal += t.total_amount_paid;
        const { firstName, lastName } = splitName(t.user_name);
        rows.push([
          csvCell(tierName),
          csvCell(firstName || "N/A"),
          csvCell(lastName),
          csvCell(t.user_email),
          csvCell(t.total_amount_paid),
          csvCell(t.referral_code || ""),
          csvCell(t.status),
          csvCell(new Date(t.created_at).toLocaleDateString("en-NG")),
          csvCell(t.checked_in_at ? new Date(t.checked_in_at).toLocaleString("en-NG") : "Not checked in"),
        ]);
      }
      rows.push(["", "", "", `Subtotal (${tierTickets.length} ticket${tierTickets.length === 1 ? "" : "s"})`, csvCell(subtotal), "", "", "", ""]);
      rows.push(["", "", "", "", "", "", "", "", ""]);
      grandTotal += subtotal;
    }
    rows.push(["", "", "", `GRAND TOTAL (${buyers.length} ticket${buyers.length === 1 ? "" : "s"})`, csvCell(grandTotal), "", "", "", ""]);

    const safe = eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadCSV(rows, `flexpass_admin_${safe}_${new Date().toISOString().split("T")[0]}.csv`);
  }

  async function handleToggleVerify(userId: string, currentVerified: boolean) {
    setProcessing("verify-" + userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/hosts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId, verified: !currentVerified }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Action failed", "error"); return; }
      setHosts(prev => prev.map(h => h.user_id === userId ? { ...h, verified: !currentVerified } : h));
      showToast(
        !currentVerified
          ? "Host verified — badge now shows on all their events."
          : "Verification removed.",
        "success"
      );
    } finally { setProcessing(null); }
  }

  async function refreshData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const [payoutsRes, deletesRes, statsRes] = await Promise.all([
        fetch("/api/admin/payouts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/delete-requests", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (payoutsRes.ok) setPayouts((await payoutsRes.json()).payouts || []);
      if (deletesRes.ok) setDeleteRequests((await deletesRes.json()).requests || []);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("[admin] background refresh failed:", e);
    }
  }

  async function handleDeleteAction(requestId: string, eventId: string, action: "approve" | "deny") {
    setProcessing(requestId + action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/admin/delete-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId, eventId, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Action failed.", "error");
        return;
      }

      showToast(data.message, "success");
      // Refresh from server so the Deleted tab shows accurate state
      await refreshData();
    } catch {
      showToast("Action failed. Please try again.", "error");
    } finally {
      setProcessing(null);
    }
  }

  if (!loading && !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)" }}>You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const displayedPayouts = payoutTab === "pending"
    ? payouts.filter(p => p.status === "pending")
    : payouts;

  // "pending" = waiting for action AND event still exists
  // "approved" = explicitly approved OR event already gone (orphaned from old failed deletes)
  const pendingDeleteCount  = deleteRequests.filter(d => d.status === "pending" && d.event_exists).length;
  const approvedDeleteCount = deleteRequests.filter(d => d.status === "approved" || !d.event_exists).length;

  const displayedDeletes =
    deleteTab === "pending"  ? deleteRequests.filter(d => d.status === "pending" && d.event_exists) :
    deleteTab === "approved" ? deleteRequests.filter(d => d.status === "approved" || !d.event_exists) :
    deleteRequests;

  const statusColor: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    paid:       "bg-green-100 text-green-700",
    rejected:   "bg-red-100 text-red-700",
    approved:   "bg-green-100 text-green-700",
    denied:     "bg-slate-100 text-slate-600",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold
          ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      <header className="border-b px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-3">
          <Logo size={32} variant="gradient" />
          <div>
            <h1 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Admin Panel</h1>
            <p className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>FlexPass operations dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/admin/checkin"
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
            style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
            <ScanLine size={14} /> Check-In
          </Link>
          <button onClick={loadData}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
            style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleLogout}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80 text-red-500 hover:bg-red-500/10">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
          </div>
        ) : (
          <>
            {/* ── Stats ── */}
            {stats && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Registered Users",  value: stats.totalUsers,    icon: <Users size={16} />,       color: "#480082", bg: "rgba(72,0,130,0.06)" },
                    { label: "Active Hosts",       value: stats.totalHosts,    icon: <CalendarDays size={16} />, color: "#9F67FE", bg: "rgba(159,103,254,0.06)" },
                    { label: "Verified Hosts",     value: stats.verifiedHosts, icon: <BadgeCheck size={16} />,  color: "#16a34a", bg: "rgba(22,163,74,0.07)" },
                    { label: "Total Events",       value: stats.totalEvents,   icon: <Ticket size={16} />,      color: "#0ea5e9", bg: "rgba(14,165,233,0.06)" },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl p-5"
                      style={{ backgroundColor: s.bg, border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center gap-1.5 mb-3" style={{ color: s.color }}>
                        {s.icon}
                        <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                        {s.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    {
                      label: "Tickets Admitted", sublabel: `${stats.scannedTickets.toLocaleString()} scanned`,
                      value: stats.totalTickets.toLocaleString(), icon: <ScanLine size={16} />,
                      color: "#22c55e", bg: "rgba(34,197,94,0.06)", highlight: false,
                    },
                    {
                      label: "Gross Revenue", sublabel: "all ticket sales",
                      value: `₦${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={16} />,
                      color: "#f59e0b", bg: "rgba(245,158,11,0.06)", highlight: false,
                    },
                    {
                      label: "FlexPass Net Revenue", sublabel: `₦${stats.platformFeeRevenue.toLocaleString()} fee − ₦${stats.paystackFeesCost.toLocaleString()} Paystack cost`,
                      value: `₦${stats.netPlatformRevenue.toLocaleString()}`, icon: <CreditCard size={16} />,
                      color: "#9F67FE", bg: "rgba(159,103,254,0.08)", highlight: false,
                    },
                    {
                      label: "Total Paid Out", sublabel: "approved withdrawals",
                      value: `₦${stats.totalPaidOut.toLocaleString()}`, icon: <ArrowDownToLine size={16} />,
                      color: "#0ea5e9", bg: "rgba(14,165,233,0.06)", highlight: false,
                    },
                    {
                      label: "Pending Payouts", sublabel: `₦${stats.pendingPayoutAmount.toLocaleString()} waiting`,
                      value: stats.pendingPayouts.toLocaleString(), icon: <Clock size={16} />,
                      color: stats.pendingPayouts > 0 ? "#ef4444" : "#6b7280",
                      bg: stats.pendingPayouts > 0 ? "rgba(239,68,68,0.06)" : "var(--card-bg)",
                      highlight: stats.pendingPayouts > 0,
                    },
                    {
                      label: "Checkout Completion", sublabel: `${stats.completedCheckouts.toLocaleString()} of ${stats.checkoutInitiated.toLocaleString()} started`,
                      value: stats.checkoutCompletionRate == null ? "—" : `${Math.round(stats.checkoutCompletionRate * 100)}%`,
                      icon: <Percent size={16} />,
                      color: "#ec4899", bg: "rgba(236,72,153,0.06)", highlight: false,
                    },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl p-5"
                      style={{ backgroundColor: s.bg, border: `1px solid ${s.highlight ? "rgba(239,68,68,0.25)" : "var(--card-border)"}` }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: s.color }}>
                        {s.icon}
                        <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{s.sublabel}</p>
                      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Main tab switcher ── */}
            <div className="flex flex-wrap gap-2 p-1 rounded-2xl w-fit" style={{ backgroundColor: "var(--surface-raised)" }}>
              {([
                { key: "withdrawals", label: `Withdrawals${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}` },
                { key: "deletes",     label: `Delete Requests${pendingDeleteCount ? ` (${pendingDeleteCount})` : ""}` },
                { key: "hosts",       label: "Hosts" },
                { key: "events",      label: "Events" },
                { key: "analytics",   label: "Analytics" },
              ] as const).map(t => (
                <button key={t.key}
                  onClick={() => {
                    setMainTab(t.key);
                    if (t.key === "hosts"     && hosts.length === 0)       loadHosts();
                    if (t.key === "events"    && adminEvents.length === 0)  loadEvents();
                    if (t.key === "analytics" && !adminAnalytics)          loadAdminAnalytics(analyticsRange);
                  }}
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                  style={{
                    backgroundColor: mainTab === t.key ? "var(--brand-indigo)" : "transparent",
                    color: mainTab === t.key ? "#fff" : "var(--text-muted)",
                  }}>
                  {t.label}
                  {t.key === "analytics" && mainTab !== "analytics" && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--brand-amber)" }} />
                  )}
                </button>
              ))}
            </div>

            {/* ── Withdrawal Queue ── */}
            {mainTab === "withdrawals" && (
              <div className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b"
                  style={{ borderColor: "var(--card-border)" }}>
                  <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    Withdrawal Requests
                  </h2>
                  <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--background)" }}>
                    {(["pending", "all"] as const).map(tab => (
                      <button key={tab} onClick={() => setPayoutTab(tab)}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition"
                        style={{
                          backgroundColor: payoutTab === tab ? "var(--brand-indigo)" : "transparent",
                          color: payoutTab === tab ? "#fff" : "var(--text-muted)",
                        }}>
                        {tab === "pending"
                          ? `Pending${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}`
                          : "All"}
                      </button>
                    ))}
                  </div>
                </div>

                {displayedPayouts.length === 0 ? (
                  <div className="py-16 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No pending requests</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>You&apos;re all caught up.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                          {["Date", "Host Email", "Bank Details", "Amount", "Status", "Actions"].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                              style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedPayouts.map((p, i) => (
                          <tr key={p.id}
                            style={{ borderBottom: i < displayedPayouts.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                            <td className="px-5 py-4 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-medium text-xs px-2 py-1 rounded-lg"
                                style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                                {p.user_email}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {p.bank_accounts ? (
                                <div>
                                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                                    {p.bank_accounts.account_name}
                                  </p>
                                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    {p.bank_accounts.bank_name} · {p.bank_accounts.account_number}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-red-500">No bank on record</span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-bold text-base" style={{ color: "var(--text-primary)" }}>
                              ₦{p.amount.toLocaleString()}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColor[p.status] || "bg-slate-100 text-slate-600"}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {p.status === "pending" ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handlePayoutAction(p.id, "approve")}
                                    disabled={!!processing}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-green-600">
                                    {processing === p.id + "approve"
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <CheckCircle2 size={13} />} Accept
                                  </button>
                                  <button
                                    onClick={() => handlePayoutAction(p.id, "reject")}
                                    disabled={!!processing}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-red-600">
                                    {processing === p.id + "reject"
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <XCircle size={13} />} Reject
                                  </button>
                                </div>
                              ) : p.status === "processing" ? (
                                <button
                                  onClick={() => handlePayoutAction(p.id, "mark_paid")}
                                  disabled={!!processing}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50"
                                  style={{ backgroundColor: "#480082" }}>
                                  {processing === p.id + "mark_paid"
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <CheckCircle2 size={13} />} Mark Paid
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Delete Requests ── */}
            {mainTab === "deletes" && (
              <div className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b"
                  style={{ borderColor: "var(--card-border)" }}>
                  <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    Event Deletion Requests
                  </h2>
                  <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--background)" }}>
                    {([
                      { key: "pending",  label: pendingDeleteCount  ? `Pending (${pendingDeleteCount})`  : "Pending",  color: pendingDeleteCount  ? "#ef4444" : undefined },
                      { key: "approved", label: approvedDeleteCount ? `Deleted (${approvedDeleteCount})` : "Deleted",  color: approvedDeleteCount ? "#16a34a" : undefined },
                      { key: "all",      label: `All (${deleteRequests.length})`, color: undefined },
                    ] as const).map(tab => (
                      <button key={tab.key} onClick={() => setDeleteTab(tab.key)}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold transition"
                        style={{
                          backgroundColor: deleteTab === tab.key ? "var(--brand-indigo)" : "transparent",
                          color: deleteTab === tab.key ? "#fff" : (tab.color ?? "var(--text-muted)"),
                        }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {displayedDeletes.length === 0 ? (
                  <div className="py-16 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {deleteTab === "pending"  ? "No pending delete requests" :
                       deleteTab === "approved" ? "No deleted events yet" :
                       "No delete requests yet"}
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>All clear.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                    {displayedDeletes.map(r => {
                      const isOrphan = !r.event_exists && r.status === "pending";
                      return (
                        <div key={r.id} className="p-6 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold truncate" style={{ color: "var(--text-primary)" }}>
                                  {r.event_title}
                                </p>
                                {isOrphan && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                    ✓ Event deleted
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {new Date(r.created_at).toLocaleDateString("en-GB", {
                                  day: "numeric", month: "short", year: "numeric",
                                })}
                                {" · "}
                                <span className="font-medium" style={{ color: "var(--brand-indigo)" }}>
                                  {r.user_email}
                                </span>
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                              isOrphan ? "bg-green-100 text-green-700" : (statusColor[r.status] || "bg-slate-100 text-slate-600")
                            }`}>
                              {isOrphan ? "approved" : r.status}
                            </span>
                          </div>

                          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-raised)" }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>REASON</p>
                            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.reason}</p>
                          </div>

                          {r.status === "pending" && r.event_exists && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleDeleteAction(r.id, r.event_id, "approve")}
                                disabled={!!processing}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-red-600">
                                {processing === r.id + "approve"
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <Trash2 size={13} />} Approve & Delete
                              </button>
                              <button
                                onClick={() => handleDeleteAction(r.id, r.event_id, "deny")}
                                disabled={!!processing}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
                                style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                                {processing === r.id + "deny"
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <XCircle size={13} />} Deny
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Hosts ── */}
            {mainTab === "hosts" && (
              <div className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b"
                  style={{ borderColor: "var(--card-border)" }}>
                  <div>
                    <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                      Host Management
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Toggle the Verified badge shown on a host&apos;s events and event cards.
                    </p>
                  </div>
                  <button onClick={loadHosts}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
                    style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                {hostsLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--brand-indigo)" }} />
                  </div>
                ) : hosts.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No hosts yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                          {["Host", "Email", "Events", "Tickets", "Revenue", "FlexPass Fee", "Creator Payout", "Promoters", "Bank Details", "Status", "Action"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                              style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hosts.map((h, i) => (
                          <tr key={h.user_id}
                            style={{ borderBottom: i < hosts.length - 1 ? "1px solid var(--card-border)" : "none" }}
                            className="hover:bg-[var(--surface-raised)] transition">
                            <td className="px-4 py-4">
                              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{h.organizer_name}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{h.email}</span>
                            </td>
                            <td className="px-4 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{h.events}</td>
                            <td className="px-4 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{h.tickets}</td>
                            <td className="px-4 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>
                              ₦{h.revenue.toLocaleString()}
                            </td>
                            <td className="px-4 py-4 font-semibold" style={{ color: "#16a34a" }}>
                              ₦{h.fee.toLocaleString()}
                            </td>
                            <td className="px-4 py-4 font-bold" style={{ color: "var(--brand-indigo)" }}>
                              ₦{(h.revenue - h.fee).toLocaleString()}
                            </td>
                            <td className="px-4 py-4">
                              {h.promoters > 0 ? (
                                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full w-fit"
                                  style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                                  <Share2 size={10} /> {h.promoters}
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {h.bank ? (
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                    {h.bank.account_name}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                    {h.bank.bank_name}
                                  </p>
                                  <p className="text-xs font-mono font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
                                    {h.bank.account_number}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                                  Not set
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {h.verified ? (
                                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full w-fit"
                                  style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                                  <BadgeCheck size={11} /> Verified
                                </span>
                              ) : (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full w-fit"
                                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>
                                  Unverified
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => handleToggleVerify(h.user_id, h.verified)}
                                disabled={processing === "verify-" + h.user_id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50"
                                style={{ backgroundColor: h.verified ? "#6b7280" : "var(--brand-indigo)" }}>
                                {processing === "verify-" + h.user_id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : h.verified
                                    ? <><ShieldOff size={12} /> Remove</>
                                    : <><BadgeCheck size={12} /> Verify</>
                                }
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Events ── */}
            {mainTab === "events" && (
              <div className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b"
                  style={{ borderColor: "var(--card-border)" }}>
                  <div>
                    <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>All Events</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Click any row to see the ticket buyers for that event.
                    </p>
                  </div>
                  <button onClick={loadEvents}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
                    style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                {eventsLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--brand-indigo)" }} />
                  </div>
                ) : adminEvents.length === 0 ? (
                  <div className="py-16 text-center">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No events yet</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                    {adminEvents.map(ev => {
                      const isExpanded = expandedEventId === ev.id;
                      const buyers = eventTickets[ev.id] || [];
                      const tierGroups = groupByTier(buyers);
                      return (
                        <div key={ev.id}>
                          {/* Event row */}
                          <button
                            onClick={() => toggleEvent(ev.id)}
                            className="w-full text-left px-6 py-4 flex items-center gap-4 hover:opacity-80 transition"
                            style={{ backgroundColor: isExpanded ? "var(--surface-raised)" : "transparent" }}>
                            {ev.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ev.image_url} alt={ev.title}
                                className="h-12 w-16 rounded-xl object-cover shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold truncate" style={{ color: "var(--text-primary)" }}>{ev.title}</p>
                                {ev.verified && (
                                  <BadgeCheck size={13} className="shrink-0" style={{ color: "#16a34a" }} />
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {new Date(ev.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                {" · "}
                                <span style={{ color: "var(--brand-indigo)" }}>{ev.host_email}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-6 shrink-0 text-sm">
                              <div className="text-center hidden sm:block">
                                <p className="font-bold" style={{ color: "var(--text-primary)" }}>{ev.tickets}</p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tickets</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="font-bold" style={{ color: "var(--text-primary)" }}>₦{ev.revenue.toLocaleString()}</p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Revenue</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="font-bold" style={{ color: "#16a34a" }}>₦{ev.fee.toLocaleString()}</p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>FlexPass Fee</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="font-bold" style={{ color: "var(--brand-indigo)" }}>₦{(ev.revenue - ev.fee).toLocaleString()}</p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Creator Payout</p>
                              </div>
                              {isExpanded
                                ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                                : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                            </div>
                          </button>

                          {/* Buyer list */}
                          {isExpanded && (
                            <div className="border-t" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--background)" }}>
                              {eventTicketsLoading === ev.id ? (
                                <div className="flex justify-center py-8">
                                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-indigo)" }} />
                                </div>
                              ) : buyers.length === 0 ? (
                                <p className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
                                  No tickets sold yet.
                                </p>
                              ) : (
                                <>
                                  <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap border-b"
                                    style={{ borderColor: "var(--card-border)" }}>
                                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                                      {buyers.length} ticket{buyers.length === 1 ? "" : "s"} across {tierGroups.size} tier{tierGroups.size === 1 ? "" : "s"}
                                    </p>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleExportEventCsv(ev.title, buyers); }}
                                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                                      style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                                      <Download size={12} /> Download CSV
                                    </button>
                                  </div>

                                  {Array.from(tierGroups.entries()).map(([tierName, tierTickets]) => {
                                    const tierRevenue = tierTickets.reduce((sum, t) => sum + t.total_amount_paid, 0);
                                    return (
                                      <div key={tierName}>
                                        <div className="px-5 py-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide"
                                          style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)" }}>
                                          <span>{tierName}</span>
                                          <span className="normal-case font-semibold" style={{ color: "var(--text-muted)" }}>
                                            {tierTickets.length} ticket{tierTickets.length === 1 ? "" : "s"} · ₦{tierRevenue.toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                                                {["Buyer", "Email", "Amount", "Via Promoter", "Status", "Date"].map(col => (
                                                  <th key={col} className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                                                    style={{ color: "var(--text-muted)" }}>{col}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {tierTickets.map((b, bi) => (
                                                <tr key={b.id}
                                                  style={{ borderBottom: bi < tierTickets.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                                                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                                                    {b.user_name || "—"}
                                                  </td>
                                                  <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                                    {b.user_email}
                                                  </td>
                                                  <td className="px-5 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                                                    {b.total_amount_paid === 0 ? "Free" : `₦${b.total_amount_paid.toLocaleString()}`}
                                                  </td>
                                                  <td className="px-5 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                                                    {b.referral_code ? (
                                                      <span className="font-mono px-2 py-0.5 rounded"
                                                        style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                                                        {b.referral_code}
                                                      </span>
                                                    ) : "—"}
                                                  </td>
                                                  <td className="px-5 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                      b.status === "scanned" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                                    }`}>
                                                      {b.status}
                                                    </span>
                                                  </td>
                                                  <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                                                    {new Date(b.created_at).toLocaleDateString("en-GB", {
                                                      day: "numeric", month: "short", year: "numeric",
                                                    })}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Analytics ── */}
            {mainTab === "analytics" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                      Platform Analytics
                    </h2>
                    <p className="text-xs mt-0.5 max-w-md" style={{ color: "var(--text-muted)" }}>
                      The same view every host gets for their own events — aggregated across every host and event on FlexPass.
                    </p>
                  </div>
                  <div className="inline-flex p-1 rounded-xl gap-0.5" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                    {(["7", "30", "90", "all"] as const).map(r => (
                      <button key={r}
                        onClick={() => { setAnalyticsRange(r); loadAdminAnalytics(r); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        style={analyticsRange === r
                          ? { backgroundColor: "var(--card-bg)", color: "var(--brand-indigo)" }
                          : { color: "var(--text-secondary)" }}>
                        {r === "all" ? "All" : `${r}D`}
                      </button>
                    ))}
                  </div>
                </div>

                {analyticsLoading && !adminAnalytics ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--brand-indigo)" }} />
                  </div>
                ) : adminAnalytics && (
                  <div className="space-y-4" style={{ opacity: analyticsLoading ? 0.6 : 1, transition: "opacity .15s" }}>
                    {/* KPI row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid var(--card-border)" }}>
                        <div className="flex items-center gap-1.5 mb-1" style={{ color: "#f59e0b" }}>
                          <TrendingUp size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Platform GMV</span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                          {analyticsRange === "all" ? "all time" : `last ${analyticsRange} days`}
                        </p>
                        <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>₦{adminAnalytics.kpis.gmv.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "rgba(236,72,153,0.06)", border: "1px solid var(--card-border)" }}>
                        <div className="flex items-center gap-1.5 mb-1" style={{ color: "#ec4899" }}>
                          <Percent size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Checkout Conversion</span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                          {adminAnalytics.kpis.checkoutCompleted.toLocaleString()} of {adminAnalytics.kpis.checkoutInitiated.toLocaleString()} started
                        </p>
                        <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                          {adminAnalytics.kpis.conversionPct !== null ? `${adminAnalytics.kpis.conversionPct}%` : "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "rgba(72,0,130,0.06)", border: "1px solid var(--card-border)" }}>
                        <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--brand-indigo)" }}>
                          <Users size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Active Hosts</span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>made a sale this period</p>
                        <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                          {adminAnalytics.kpis.activeHosts} <span className="text-lg" style={{ color: "var(--text-muted)" }}>/ {adminAnalytics.kpis.totalHosts}</span>
                        </p>
                      </div>
                    </div>

                    {/* Momentum + Funnel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Platform sales momentum</h3>
                        <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--text-muted)" }}>Daily GMV across every event</p>
                        <MomentumChart
                          data={adminAnalytics.momentum}
                          formatValue={(v) => `₦${Math.round(v).toLocaleString()}`}
                          formatAxis={(v) => v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `₦${Math.round(v / 1e3)}K` : `₦${v}`}
                        />
                      </div>
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Checkout funnel</h3>
                        <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>Every host&apos;s checkout, combined</p>
                        <FunnelBars funnel={adminAnalytics.funnel} />
                      </div>
                    </div>

                    {/* Sources + Top events */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Traffic sources, platform-wide</h3>
                        <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-muted)" }}>Direct vs. promoter-driven tickets</p>
                        {adminAnalytics.sources.every(s => s.tickets === 0) ? (
                          <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>No ticket sales in this window yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {adminAnalytics.sources.map((s, i) => {
                              const max = Math.max(...adminAnalytics.sources.map(x => x.tickets), 1);
                              const pct = Math.round((s.tickets / max) * 100);
                              const color = i === 0 ? "#480082" : "#9F67FE";
                              return (
                                <div key={s.name}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      <b style={{ color: "var(--text-primary)" }}>{s.tickets.toLocaleString()}</b> tickets · ₦{s.revenue.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-raised)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <div className="p-5 pb-3">
                          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Top events this period</h3>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ranked by revenue, all hosts</p>
                        </div>
                        {adminAnalytics.topEvents.length === 0 ? (
                          <p className="text-xs px-5 pb-5" style={{ color: "var(--text-muted)" }}>No events yet.</p>
                        ) : (
                          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                            {adminAnalytics.topEvents.map((e, i) => (
                              <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-bold shrink-0"
                                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{e.title}</p>
                                  <p className="text-[10.5px] truncate" style={{ color: "var(--text-muted)" }}>{e.hostName}</p>
                                </div>
                                <EventPaceChip status={e.pace} size="xs" />
                                <span className="text-xs font-bold shrink-0 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                                  ₦{e.revenue.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top hosts */}
                    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                      <div className="p-5 pb-3">
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Top hosts this period</h3>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Ranked by revenue — plus what FlexPass earned in fees from each
                        </p>
                      </div>
                      {adminAnalytics.topHosts.length === 0 ? (
                        <p className="text-xs px-5 pb-5" style={{ color: "var(--text-muted)" }}>No hosts yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" style={{ minWidth: 560 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                                {["Host", "Events", "Avg. conversion", "Revenue", "FlexPass fee earned"].map(h => (
                                  <th key={h} className="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider"
                                    style={{ color: "var(--text-muted)" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {adminAnalytics.topHosts.map((h, i) => (
                                <tr key={h.userId} style={{ borderBottom: i < adminAnalytics.topHosts.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                                  <td className="px-5 py-3 font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                                    {h.name}
                                    {h.verified && <BadgeCheck size={13} style={{ color: "#16a34a" }} />}
                                  </td>
                                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{h.events}</td>
                                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                                    {h.avgConversionPct !== null ? `${h.avgConversionPct}%` : "—"}
                                  </td>
                                  <td className="px-5 py-3 font-bold" style={{ color: "var(--text-primary)" }}>₦{h.revenue.toLocaleString()}</td>
                                  <td className="px-5 py-3 font-semibold" style={{ color: "#16a34a" }}>₦{h.feeEarned.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Audience */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Gender split</h3>
                        <p className="text-xs mt-0.5 mb-1" style={{ color: "var(--text-muted)" }}>Buyers platform-wide</p>
                        <GenderDonut
                          female={adminAnalytics.audience.gender.female}
                          male={adminAnalytics.audience.gender.male}
                          other={adminAnalytics.audience.gender.other}
                          total={adminAnalytics.audience.gender.totalCounted}
                        />
                      </div>
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>New vs. returning buyers</h3>
                        <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>Across the whole platform</p>
                        {adminAnalytics.audience.newVsReturning.totalBuyers === 0 ? (
                          <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>No buyers yet.</p>
                        ) : (
                          <>
                            <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--surface-raised)" }}>
                              <div style={{ width: `${adminAnalytics.audience.newVsReturning.newPct}%`, backgroundColor: "var(--brand-lavender)" }} />
                              <div style={{ width: `${adminAnalytics.audience.newVsReturning.returningPct}%`, backgroundColor: "rgba(159,103,254,0.18)" }} />
                            </div>
                            <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <span><b style={{ color: "var(--text-primary)" }}>{adminAnalytics.audience.newVsReturning.newPct}%</b> new</span>
                              <span><b style={{ color: "var(--text-primary)" }}>{adminAnalytics.audience.newVsReturning.returningPct}%</b> returning</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Average show-up rate</h3>
                        <p className="text-xs mt-0.5 mb-1" style={{ color: "var(--text-muted)" }}>Checked in vs. sold, past events</p>
                        {!adminAnalytics.audience.showUpRate ? (
                          <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>No past events yet.</p>
                        ) : (
                          <>
                            <p className="text-3xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>{adminAnalytics.audience.showUpRate.pct}%</p>
                            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                              of {adminAnalytics.audience.showUpRate.sampleSize.toLocaleString()} sold tickets scanned in at the door
                            </p>
                            <div className="h-2 rounded-full overflow-hidden mt-3" style={{ backgroundColor: "var(--surface-raised)" }}>
                              <div className="h-full rounded-full" style={{ width: `${adminAnalytics.audience.showUpRate.pct}%`, backgroundColor: "var(--brand-lavender)" }} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
