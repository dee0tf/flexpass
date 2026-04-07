"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, DollarSign, Ticket, Users, Calendar, Edit, Download, Plus } from "lucide-react";
import SalesChart from "@/components/SalesChart";
import Link from "next/link";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<{
    revenue: number;
    ticketsSold: number;
    activeEvents: number;
    recentSales: any[];
    myEvents: any[];
    chartData: any[];
  }>({
    revenue: 0,
    ticketsSold: 0,
    activeEvents: 0,
    recentSales: [],
    myEvents: [],
    chartData: [],
  });
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state — fires immediately with current session (no network call)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      await loadDashboardData(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function loadDashboardData(userId: string) {
    try {
      const { data: myEvents } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!myEvents || myEvents.length === 0) {
        setStats({ revenue: 0, ticketsSold: 0, activeEvents: 0, recentSales: [], myEvents: [], chartData: [] });
        setLoading(false);
        return;
      }

      const myEventIds = myEvents.map(e => e.id);

      const { data: myTickets } = await supabase
        .from("tickets")
        .select("*, events(title, price)")
        .in("event_id", myEventIds)
        .eq("status", "valid")
        .order("created_at", { ascending: false });

      const ticketsSold = myTickets?.length || 0;
      const revenue = myTickets?.reduce((acc, t) => acc + (t.events?.price || 0), 0) || 0;

      const chartDataMap = new Map<string, number>();
      myTickets?.forEach((ticket) => {
        const title = ticket.events?.title || "Unknown";
        chartDataMap.set(title, (chartDataMap.get(title) || 0) + (ticket.events?.price || 0));
      });
      const chartData = Array.from(chartDataMap.entries()).map(([name, rev]) => ({
        name: name.length > 20 ? name.slice(0, 17) + "..." : name,
        revenue: rev,
      }));

      setStats({
        revenue,
        ticketsSold,
        activeEvents: myEvents.length,
        recentSales: myTickets || [],
        myEvents,
        chartData,
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleExport = () => {
    if (!stats.recentSales.length) { alert("No data to export"); return; }
    const headers = ["Ticket ID", "Event", "Customer Name", "Email", "Amount", "Status", "Date"];
    const rows = stats.recentSales.map(ticket => [
      ticket.id,
      `"${(ticket.events?.title || "Unknown").replace(/"/g, '""')}"`,
      `"${(ticket.user_name || "N/A").replace(/"/g, '""')}"`,
      ticket.user_email,
      ticket.events?.price || 0,
      ticket.status,
      new Date(ticket.created_at).toLocaleDateString(),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flexpass_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#480082]" />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme">Dashboard Overview</h2>
          <p className="text-theme-2 text-sm mt-0.5">
            {user?.email ? `Logged in as ${user.email}` : "Welcome back"}
          </p>
        </div>
        <Link href="/create">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white hover:opacity-90 transition"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            <Plus size={16} /> New Event
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-2 bg-green-100 rounded-lg w-fit mb-4">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-theme-2 text-sm">Total Revenue</p>
          <h3 className="text-3xl font-bold text-theme mt-1">₦{stats.revenue.toLocaleString()}</h3>
        </div>

        <div className="p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-2 bg-[#480082]/10 rounded-lg w-fit mb-4">
            <Ticket className="h-6 w-6 text-[#480082]" />
          </div>
          <p className="text-theme-2 text-sm">Tickets Sold</p>
          <h3 className="text-3xl font-bold text-theme mt-1">{stats.ticketsSold}</h3>
        </div>

        <div className="p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-2 bg-amber-100 rounded-lg w-fit mb-4">
            <Users className="h-6 w-6 text-amber-600" />
          </div>
          <p className="text-theme-2 text-sm">Your Events</p>
          <h3 className="text-3xl font-bold text-theme mt-1">{stats.activeEvents}</h3>
        </div>
      </div>

      {/* Empty state for new users */}
      {stats.myEvents.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--card-bg)", border: "2px dashed var(--card-border)" }}>
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(72,0,130,0.08)" }}>
            <Plus className="h-8 w-8" style={{ color: "var(--brand-indigo)" }} />
          </div>
          <h3 className="text-xl font-bold mb-2 text-theme">Create your first event</h3>
          <p className="text-theme-2 text-sm mb-6 max-w-sm mx-auto">
            Start selling tickets in minutes. Set up tiers, share your event link, and get paid automatically.
          </p>
          <Link href="/create">
            <button className="px-8 py-3 rounded-xl font-bold text-white hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              Create Event
            </button>
          </Link>
        </div>
      )}

      {/* Chart */}
      {stats.chartData.length > 0 && (
        <div className="p-6 rounded-2xl shadow-sm" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <h3 className="font-bold text-lg text-theme mb-1">Revenue by Event</h3>
          <p className="text-theme-2 text-sm mb-6">See which experiences are performing best.</p>
          <SalesChart data={stats.chartData} />
        </div>
      )}

      {/* My Events */}
      {stats.myEvents.length > 0 && (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-6" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <h3 className="font-bold text-lg text-theme">My Events</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {stats.myEvents.map((event: any) => (
              <div key={event.id} className="p-4 flex items-center justify-between hover:bg-[var(--surface-raised)] transition">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-12 w-12 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                    {event.image_url && <img src={event.image_url} alt={event.title} className="object-cover w-full h-full" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-theme truncate">{event.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-theme-2 mt-0.5">
                      <Calendar size={11} />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/events/${event.id}/edit`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ml-4"
                  style={{ border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                >
                  <Edit size={13} /> Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {stats.recentSales.length > 0 && (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="p-6 flex items-center justify-between" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <h3 className="font-bold text-lg text-theme">Recent Transactions</h3>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
              <Download size={15} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase font-medium" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>
                <tr>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody style={{ color: "var(--text-secondary)" }}>
                {stats.recentSales.slice(0, 5).map((ticket) => (
                  <tr key={ticket.id} className="border-t transition hover:bg-[var(--surface-raised)]"
                    style={{ borderColor: "var(--card-border)" }}>
                    <td className="px-6 py-4 font-medium text-theme">{ticket.events?.title || "Unknown"}</td>
                    <td className="px-6 py-4">{ticket.user_email}</td>
                    <td className="px-6 py-4">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold">₦{(ticket.events?.price ?? 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Paid</span>
                    </td>
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
