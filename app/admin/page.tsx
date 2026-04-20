"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Building2,
  Users, Ticket, TrendingUp, Clock, AlertCircle
} from "lucide-react";
import Logo from "@/components/Logo";

const ADMIN_EMAIL = "flexpasshome@gmail.com";

type Payout = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  transfer_code: string | null;
  user_id: string;
  bank_accounts: {
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
  user_email?: string;
};

type Stats = {
  totalUsers: number;
  totalEvents: number;
  totalTickets: number;
  totalRevenue: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || session.user.email !== ADMIN_EMAIL) {
        setLoading(false);
        return;
      }
      setAuthorized(true);
      loadData(session.access_token);
    });
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function loadData(token?: string) {
    setLoading(true);
    try {
      // Payouts with bank info
      const { data: payoutData } = await supabase
        .from("payouts")
        .select("*, bank_accounts(bank_name, account_number, account_name)")
        .order("created_at", { ascending: false });

      // Enrich with user emails via auth.users (service role needed — we fetch from profiles if available)
      const enriched: Payout[] = [];
      for (const p of payoutData || []) {
        // Try to get email from a profiles table, fallback to user_id display
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", p.user_id)
          .single();
        enriched.push({ ...p, user_email: profile?.email || p.user_id.slice(0, 8) + "..." });
      }
      setPayouts(enriched);

      // Stats
      const [{ count: totalUsers }, { count: totalEvents }, { count: totalTickets }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "valid"),
      ]);

      const { data: ticketRevenue } = await supabase
        .from("tickets")
        .select("events(price)")
        .eq("status", "valid");

      const totalRevenue = ticketRevenue?.reduce((acc: number, t: any) => acc + (t.events?.price || 0), 0) || 0;
      const pending = enriched.filter(p => p.status === "pending");

      setStats({
        totalUsers: totalUsers || 0,
        totalEvents: totalEvents || 0,
        totalTickets: totalTickets || 0,
        totalRevenue,
        pendingPayouts: pending.length,
        pendingPayoutAmount: pending.reduce((acc, p) => acc + p.amount, 0),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(payoutId: string, action: "approve" | "reject") {
    setProcessing(payoutId + action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/admin/process-withdrawal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ payout_id: payoutId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Something went wrong.", "error");
      } else {
        showToast(data.message, "success");
        // Optimistically update the row
        setPayouts(prev => prev.map(p =>
          p.id === payoutId
            ? { ...p, status: action === "approve" ? "processing" : "rejected" }
            : p
        ));
        // Refresh stats
        loadData();
      }
    } finally {
      setProcessing(null);
    }
  }

  // ── Not authorized ──
  if (!loading && !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)" }}>You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const displayed = activeTab === "pending"
    ? payouts.filter(p => p.status === "pending")
    : payouts;

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    processing: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold animate-fade-in
          ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-3">
          <Logo size={32} variant="gradient" />
          <div>
            <h1 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>FlexPass operations dashboard</p>
          </div>
        </div>
        <button onClick={() => loadData()} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Users", value: stats.totalUsers, icon: <Users size={18} />, color: "#480082" },
                  { label: "Events", value: stats.totalEvents, icon: <Ticket size={18} />, color: "#9F67FE" },
                  { label: "Tickets Sold", value: stats.totalTickets, icon: <Ticket size={18} />, color: "#22c55e" },
                  { label: "Total Revenue", value: `₦${stats.totalRevenue.toLocaleString()}`, icon: <TrendingUp size={18} />, color: "#f59e0b" },
                  { label: "Pending Requests", value: stats.pendingPayouts, icon: <Clock size={18} />, color: "#ef4444", highlight: stats.pendingPayouts > 0 },
                  { label: "Pending Amount", value: `₦${stats.pendingPayoutAmount.toLocaleString()}`, icon: <Building2 size={18} />, color: "#ef4444", highlight: stats.pendingPayoutAmount > 0 },
                ].map(s => (
                  <div key={s.label}
                    className="rounded-2xl p-4 space-y-2"
                    style={{
                      backgroundColor: s.highlight ? "rgba(239,68,68,0.06)" : "var(--card-bg)",
                      border: `1px solid ${s.highlight ? "rgba(239,68,68,0.2)" : "var(--card-border)"}`,
                    }}>
                    <div className="flex items-center gap-1.5" style={{ color: s.color }}>
                      {s.icon}
                      <span className="text-xs font-semibold">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Withdrawal Queue */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--card-border)" }}>
                <h2 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                  Withdrawal Requests
                </h2>
                <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--background)" }}>
                  {(["pending", "all"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition"
                      style={{
                        backgroundColor: activeTab === tab ? "var(--brand-indigo)" : "transparent",
                        color: activeTab === tab ? "#fff" : "var(--text-muted)",
                      }}>
                      {tab === "pending"
                        ? `Pending${stats?.pendingPayouts ? ` (${stats.pendingPayouts})` : ""}`
                        : "All"}
                    </button>
                  ))}
                </div>
              </div>

              {displayed.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {activeTab === "pending" ? "No pending requests" : "No withdrawals yet"}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                    {activeTab === "pending" ? "You're all caught up." : "Requests will appear here once hosts submit them."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                        {["Date", "Host", "Bank Details", "Amount", "Status", "Actions"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((p, i) => (
                        <tr key={p.id}
                          style={{ borderBottom: i < displayed.length - 1 ? "1px solid var(--card-border)" : "none" }}>
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
                                  onClick={() => handleAction(p.id, "approve")}
                                  disabled={!!processing}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50"
                                  style={{ backgroundColor: "#16a34a" }}>
                                  {processing === p.id + "approve"
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <CheckCircle2 size={13} />}
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleAction(p.id, "reject")}
                                  disabled={!!processing}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-80 disabled:opacity-50"
                                  style={{ backgroundColor: "#dc2626" }}>
                                  {processing === p.id + "reject"
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <XCircle size={13} />}
                                  Reject
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
          </>
        )}
      </div>
    </div>
  );
}
