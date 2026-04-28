"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Building2,
  Users, Ticket, TrendingUp, Clock, AlertCircle, Trash2,
} from "lucide-react";
import Logo from "@/components/Logo";

const ADMIN_EMAIL = "flexpasshome@gmail.com";

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
  totalUsers: number; totalEvents: number; totalTickets: number;
  totalRevenue: number; pendingPayouts: number; pendingPayoutAmount: number;
  pendingDeletes: number;
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
  const [mainTab, setMainTab] = useState<"withdrawals" | "deletes">("withdrawals");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || session.user.email !== ADMIN_EMAIL) { setLoading(false); return; }
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
      // Payouts
      const { data: payoutData } = await supabase
        .from("payouts")
        .select("*, bank_accounts(bank_name, account_number, account_name)")
        .order("created_at", { ascending: false });

      const enriched: Payout[] = (payoutData || []).map((p: any) => ({
        ...p,
        user_email: p.user_id.slice(0, 8) + "...",
      }));
      setPayouts(enriched);

      // Delete requests
      const { data: delData } = await supabase
        .from("delete_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setDeleteRequests(delData || []);

      // Stats
      const [{ count: totalUsers }, { count: totalEvents }, { count: totalTickets }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "valid"),
      ]);

      const { data: ticketRevenue } = await supabase
        .from("tickets").select("events(price)").eq("status", "valid");

      const totalRevenue = ticketRevenue?.reduce((acc: number, t: any) => acc + (t.events?.price || 0), 0) || 0;
      const pending = enriched.filter(p => p.status === "pending");
      const pendingDeletes = (delData || []).filter((d: DeleteRequest) => d.status === "pending").length;

      setStats({
        totalUsers: totalUsers || 0,
        totalEvents: totalEvents || 0,
        totalTickets: totalTickets || 0,
        totalRevenue,
        pendingPayouts: pending.length,
        pendingPayoutAmount: pending.reduce((acc, p) => acc + p.amount, 0),
        pendingDeletes,
      });
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { label: "Users", value: stats.totalUsers, icon: <Users size={18} />, color: "#480082" },
                  { label: "Events", value: stats.totalEvents, icon: <Ticket size={18} />, color: "#9F67FE" },
                  { label: "Tickets Sold", value: stats.totalTickets, icon: <Ticket size={18} />, color: "#22c55e" },
                  { label: "Revenue", value: `₦${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={18} />, color: "#f59e0b" },
                  { label: "Pending Payouts", value: stats.pendingPayouts, icon: <Clock size={18} />, color: "#ef4444", highlight: stats.pendingPayouts > 0 },
                  { label: "Payout Amount", value: `₦${stats.pendingPayoutAmount.toLocaleString()}`, icon: <Building2 size={18} />, color: "#ef4444", highlight: stats.pendingPayoutAmount > 0 },
                  { label: "Delete Requests", value: stats.pendingDeletes, icon: <Trash2 size={18} />, color: "#ef4444", highlight: stats.pendingDeletes > 0 },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4 space-y-2"
                    style={{ backgroundColor: (s as any).highlight ? "rgba(239,68,68,0.06)" : "var(--card-bg)", border: `1px solid ${(s as any).highlight ? "rgba(239,68,68,0.2)" : "var(--card-border)"}` }}>
                    <div className="flex items-center gap-1.5" style={{ color: s.color }}>{s.icon}<span className="text-xs font-semibold">{s.label}</span></div>
                    <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Main tab switcher */}
            <div className="flex gap-2 p-1 rounded-2xl w-fit" style={{ backgroundColor: "var(--surface-raised)" }}>
              {([
                { key: "withdrawals", label: `Withdrawals${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}` },
                { key: "deletes", label: `Delete Requests${stats?.pendingDeletes ? ` (${stats.pendingDeletes})` : ""}` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setMainTab(t.key)}
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
          </>
        )}
      </div>
    </div>
  );
}
