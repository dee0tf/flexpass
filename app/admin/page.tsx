"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Building2,
  Users, Ticket, TrendingUp, Clock, AlertCircle, Trash2, BadgeCheck, ShieldOff,
  ScanLine, ArrowDownToLine, CalendarDays,
} from "lucide-react";
import Logo from "@/components/Logo";

type Payout = {
  id: string; amount: number; status: string; created_at: string;
  transfer_code: string | null; user_id: string;
  bank_accounts: { bank_name: string; account_number: string; account_name: string } | null;
  user_email?: string;
};

type DeleteRequest = {
  id: string; event_id: string; event_title: string;
  reason: string; status: string; created_at: string; user_id: string;
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
  const [mainTab, setMainTab] = useState<"withdrawals" | "deletes" | "hosts">("withdrawals");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);

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

      const [payoutRes, delRes, statsRes] = await Promise.all([
        supabase
          .from("payouts")
          .select("*, bank_accounts(bank_name, account_number, account_name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("delete_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const enriched: Payout[] = ((payoutRes.data) || []).map((p: any) => ({
        ...p,
        user_email: p.user_id.slice(0, 8) + "...",
      }));
      setPayouts(enriched);
      setDeleteRequests(delRes.data || []);

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
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
      if (!res.ok) { showToast(data.error || "Something went wrong.", "error"); }
      else {
        showToast(data.message, "success");
        setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status: action === "approve" ? "processing" : "rejected" } : p));
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
    } finally {
      setHostsLoading(false);
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
      showToast(!currentVerified ? "Host verified — badge now shows on all their events." : "Verification removed.", "success");
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeleteAction(requestId: string, eventId: string, action: "approve" | "deny") {
    setProcessing(requestId + action);
    try {
      const newStatus = action === "approve" ? "approved" : "denied";

      if (action === "approve") {
        // Actually delete the event
        await supabase.from("events").delete().eq("id", eventId);
      }

      await supabase.from("delete_requests").update({ status: newStatus }).eq("id", requestId);
      showToast(action === "approve" ? "Event deleted and request approved." : "Request denied.", "success");
      setDeleteRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
      loadData();
    } catch {
      showToast("Action failed. Please try again.", "error");
    } finally { setProcessing(null); }
  }

  if (!loading && !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)" }}>You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const displayedPayouts = payoutTab === "pending" ? payouts.filter(p => p.status === "pending") : payouts;
  const displayedDeletes = deleteRequests.filter(d => d.status === "pending");

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    approved: "bg-green-100 text-green-700",
    denied: "bg-slate-100 text-slate-600",
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
        <button onClick={loadData} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
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
            {/* Stats */}
            {stats && (
              <div className="space-y-3">
                {/* Row 1 — People */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Registered Users", value: stats.totalUsers, icon: <Users size={16} />, color: "#480082", bg: "rgba(72,0,130,0.06)" },
                    { label: "Active Hosts", value: stats.totalHosts, icon: <CalendarDays size={16} />, color: "#9F67FE", bg: "rgba(159,103,254,0.06)" },
                    { label: "Verified Hosts", value: stats.verifiedHosts, icon: <BadgeCheck size={16} />, color: "#16a34a", bg: "rgba(22,163,74,0.07)" },
                    { label: "Total Events", value: stats.totalEvents, icon: <Ticket size={16} />, color: "#0ea5e9", bg: "rgba(14,165,233,0.06)" },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl p-5" style={{ backgroundColor: s.bg, border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center gap-1.5 mb-3" style={{ color: s.color }}>
                        {s.icon}<span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                {/* Row 2 — Money & Ops */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Tickets Admitted", sublabel: `${stats.scannedTickets.toLocaleString()} scanned`, value: stats.totalTickets.toLocaleString(), icon: <ScanLine size={16} />, color: "#22c55e", bg: "rgba(34,197,94,0.06)", highlight: false },
                    { label: "Gross Revenue", sublabel: "all ticket sales", value: `₦${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={16} />, color: "#f59e0b", bg: "rgba(245,158,11,0.06)", highlight: false },
                    { label: "Total Paid Out", sublabel: "approved withdrawals", value: `₦${stats.totalPaidOut.toLocaleString()}`, icon: <ArrowDownToLine size={16} />, color: "#0ea5e9", bg: "rgba(14,165,233,0.06)", highlight: false },
                    { label: "Pending Payouts", sublabel: `₦${stats.pendingPayoutAmount.toLocaleString()} waiting`, value: stats.pendingPayouts.toLocaleString(), icon: <Clock size={16} />, color: stats.pendingPayouts > 0 ? "#ef4444" : "#6b7280", bg: stats.pendingPayouts > 0 ? "rgba(239,68,68,0.06)" : "var(--card-bg)", highlight: stats.pendingPayouts > 0 },
                  ].map(s => (
                    <div key={s.label} className="rounded-2xl p-5" style={{ backgroundColor: s.bg, border: `1px solid ${s.highlight ? "rgba(239,68,68,0.25)" : "var(--card-border)"}` }}>
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: s.color }}>
                        {s.icon}<span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{s.sublabel}</p>
                      <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main tab switcher */}
            <div className="flex gap-2 p-1 rounded-2xl w-fit" style={{ backgroundColor: "var(--surface-raised)" }}>
              {([
                { key: "withdrawals", label: `Withdrawals${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}` },
                { key: "deletes", label: `Delete Requests${stats?.pendingDeletes ? ` (${stats.pendingDeletes})` : ""}` },
                { key: "hosts", label: "Hosts" },
              ] as const).map(t => (
                <button key={t.key} onClick={() => {
                  setMainTab(t.key);
                  if (t.key === "hosts" && hosts.length === 0) loadHosts();
                }}
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition"
                  style={{ backgroundColor: mainTab === t.key ? "var(--brand-indigo)" : "transparent", color: mainTab === t.key ? "#fff" : "var(--text-muted)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Withdrawal Queue */}
            {mainTab === "withdrawals" && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--card-border)" }}>
                  <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Withdrawal Requests</h2>
                  <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--background)" }}>
                    {(["pending", "all"] as const).map(tab => (
                      <button key={tab} onClick={() => setPayoutTab(tab)}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition"
                        style={{ backgroundColor: payoutTab === tab ? "var(--brand-indigo)" : "transparent", color: payoutTab === tab ? "#fff" : "var(--text-muted)" }}>
                        {tab === "pending" ? `Pending${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}` : "All"}
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
                          {["Date", "Host", "Bank Details", "Amount", "Status", "Actions"].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedPayouts.map((p, i) => (
                          <tr key={p.id} style={{ borderBottom: i < displayedPayouts.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                            <td className="px-5 py-4 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-medium text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>{p.user_email}</span>
                            </td>
                            <td className="px-5 py-4">
                              {p.bank_accounts ? (
                                <div>
                                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{p.bank_accounts.account_name}</p>
                                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{p.bank_accounts.bank_name} · {p.bank_accounts.account_number}</p>
                                </div>
                              ) : <span className="text-xs text-red-500">No bank on record</span>}
                            </td>
                            <td className="px-5 py-4 font-bold text-base" style={{ color: "var(--text-primary)" }}>₦{p.amount.toLocaleString()}</td>
                            <td className="px-5 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColor[p.status] || "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                            </td>
                            <td className="px-5 py-4">
                              {p.status === "pending" ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handlePayoutAction(p.id, "approve")} disabled={!!processing}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-green-600">
                                    {processing === p.id + "approve" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Accept
                                  </button>
                                  <button onClick={() => handlePayoutAction(p.id, "reject")} disabled={!!processing}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-red-600">
                                    {processing === p.id + "reject" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.transfer_code ? p.transfer_code.slice(0, 16) + "…" : "—"}</span>
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

            {/* Delete Requests */}
            {mainTab === "deletes" && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    Event Deletion Requests
                    {stats?.pendingDeletes ? <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{stats.pendingDeletes} pending</span> : null}
                  </h2>
                </div>
                {displayedDeletes.length === 0 ? (
                  <div className="py-16 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No pending delete requests</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>All clear.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                    {displayedDeletes.map(r => (
                      <div key={r.id} className="p-6 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-bold truncate" style={{ color: "var(--text-primary)" }}>{r.event_title}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {r.user_id.slice(0, 8)}...
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusColor[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-raised)" }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>REASON</p>
                          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.reason}</p>
                        </div>
                        {r.status === "pending" && (
                          <div className="flex gap-3">
                            <button onClick={() => handleDeleteAction(r.id, r.event_id, "approve")} disabled={!!processing}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50 bg-red-600">
                              {processing === r.id + "approve" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Approve & Delete
                            </button>
                            <button onClick={() => handleDeleteAction(r.id, r.event_id, "deny")} disabled={!!processing}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
                              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                              {processing === r.id + "deny" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Deny
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Hosts & Verification */}
            {mainTab === "hosts" && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--card-border)" }}>
                  <div>
                    <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Host Management</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Toggle the Verified badge shown on a host's events and event cards.</p>
                  </div>
                  <button onClick={loadHosts} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
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
                          {["Host", "Email", "Events", "Tickets", "Revenue", "Status", "Action"].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hosts.map((h, i) => (
                          <tr key={h.user_id} style={{ borderBottom: i < hosts.length - 1 ? "1px solid var(--card-border)" : "none" }}
                            className="hover:bg-[var(--surface-raised)] transition">
                            <td className="px-5 py-4">
                              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{h.organizer_name}</p>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{h.email}</span>
                            </td>
                            <td className="px-5 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{h.events}</td>
                            <td className="px-5 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>{h.tickets}</td>
                            <td className="px-5 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>₦{h.revenue.toLocaleString()}</td>
                            <td className="px-5 py-4">
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
                            <td className="px-5 py-4">
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
          </>
        )}
      </div>
    </div>
  );
}
