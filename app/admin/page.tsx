"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Building2,
  Users, Ticket, TrendingUp, Clock, AlertCircle, Trash2, BadgeCheck, ShieldOff,
  ScanLine, ArrowDownToLine, CalendarDays, ChevronDown, ChevronUp, CreditCard, Share2,
} from "lucide-react";
import Logo from "@/components/Logo";

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
  totalRevenue: number; totalPaidOut: number;
  pendingPayouts: number; pendingPayoutAmount: number;
  pendingDeletes: number;
};

type Host = {
  user_id: string; email: string; organizer_name: string;
  events: number; tickets: number; revenue: number; verified: boolean;
  promoters: number;
  bank: { bank_name: string; account_number: string; account_name: string } | null;
};

type AdminEvent = {
  id: string; title: string; date: string; image_url: string | null;
  organizer_name: string; verified: boolean;
  host_email: string; tickets: number; revenue: number;
};

type AdminTicket = {
  id: string; user_name: string; user_email: string;
  tier_name: string | null; total_amount_paid: number;
  status: string; created_at: string; referral_code: string | null;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [payoutTab, setPayoutTab] = useState<"pending" | "all">("pending");
  const [deleteTab, setDeleteTab] = useState<"pending" | "approved" | "all">("pending");
  const [mainTab, setMainTab] = useState<"withdrawals" | "deletes" | "hosts" | "events">("withdrawals");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventTickets, setEventTickets] = useState<Record<string, AdminTicket[]>>({});
  const [eventTicketsLoading, setEventTicketsLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      const res = await fetch("/api/admin/check-auth", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setLoading(false); return; }
      setAuthorized(true);
      loadData();
    });
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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

  async function handlePayoutAction(payoutId: string, action: "approve" | "reject") {
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
        setPayouts(prev => prev.map(p =>
          p.id === payoutId ? { ...p, status: action === "approve" ? "processing" : "rejected" } : p
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
      if (res.ok) setAdminEvents(data.events || []);
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

  function toggleEvent(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(eventId);
      loadEventTickets(eventId);
    }
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

      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-3">
          <Logo size={32} variant="gradient" />
          <div>
            <h1 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>FlexPass operations dashboard</p>
          </div>
        </div>
        <button onClick={loadData}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
          style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
          <RefreshCw size={14} /> Refresh
        </button>
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              ] as const).map(t => (
                <button key={t.key}
                  onClick={() => {
                    setMainTab(t.key);
                    if (t.key === "hosts"  && hosts.length === 0)       loadHosts();
                    if (t.key === "events" && adminEvents.length === 0)  loadEvents();
                  }}
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition"
                  style={{
                    backgroundColor: mainTab === t.key ? "var(--brand-indigo)" : "transparent",
                    color: mainTab === t.key ? "#fff" : "var(--text-muted)",
                  }}>
                  {t.label}
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
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  {p.transfer_code ? p.transfer_code.slice(0, 16) + "…" : "—"}
                                </span>
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
                          {["Host", "Email", "Events", "Tickets", "Revenue", "Promoters", "Bank Details", "Status", "Action"].map(h => (
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
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                                        {["Buyer", "Email", "Tier", "Amount", "Via Promoter", "Status", "Date"].map(col => (
                                          <th key={col} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                            style={{ color: "var(--text-muted)" }}>{col}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {buyers.map((b, bi) => (
                                        <tr key={b.id}
                                          style={{ borderBottom: bi < buyers.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                                          <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                                            {b.user_name || "—"}
                                          </td>
                                          <td className="px-5 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                            {b.user_email}
                                          </td>
                                          <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                                            {b.tier_name || "Standard"}
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
          </>
        )}
      </div>
    </div>
  );
}
