"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, DollarSign, Ticket, Users, Calendar, Edit, Download } from "lucide-react";
import SalesChart from "@/components/SalesChart";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    ticketsSold: 0,
    activeEvents: 0,
    recentSales: [] as any[],
    myEvents: [] as any[]
  });
  const router = useRouter();

  useEffect(() => {
    async function loadDashboardData() {
      // 1. Get Current User
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }


      // 2. Fetch EVENTS created by this user
      const { data: myEvents } = await supabase
        .from("events")
        .select("*") // Fetch all fields for the list
        .eq("user_id", user.id); // <--- CRITICAL SECURITY FILTER

      if (!myEvents || myEvents.length === 0) {
        setLoading(false);
        return; // New user with no events
      }

      // 3. Fetch TICKETS for these specific events
      const myEventIds = myEvents.map(e => e.id);

      const { data: myTickets } = await supabase
        .from("tickets")
        .select("*, events(title, price)")
        .in("event_id", myEventIds) // <--- Only tickets for MY events
        .eq("status", "valid")
        .order("created_at", { ascending: false });

      // 4. Calculate Stats & Chart Data
      const ticketsSold = myTickets?.length || 0;

      // Calculate Revenue
      const revenue = myTickets?.reduce((acc, ticket) => {
        // @ts-ignore
        return acc + (ticket.events?.price || 0);
      }, 0) || 0;

      // Group by event title for chart
      const chartDataMap = new Map();
      myTickets?.forEach((ticket) => {
        const title = ticket.events?.title || "Unknown";
        const price = ticket.events?.price || 0;
        chartDataMap.set(title, (chartDataMap.get(title) || 0) + price);
      });

      const chartData = Array.from(chartDataMap.entries()).map(([name, revenue]) => ({
        name: name.length > 20 ? name.slice(0, 17) + "..." : name,
        revenue
      }));

      setStats({
        revenue,
        ticketsSold,
        activeEvents: myEvents.length,
        recentSales: myTickets || [],
        myEvents: myEvents || [],
        chartData
      } as any);

      setLoading(false);
    }

    loadDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#480082]" />
      </div>
    );
  }

  const handleExport = () => {
    if (!stats.recentSales || stats.recentSales.length === 0) {
      alert("No data to export");
      return;
    }

    // 1. Define CSV Headers
    const headers = ["Ticket ID", "Event", "Customer Name", "Email", "Amount", "Status", "Date"];

    // 2. Map Data to CSV Rows
    const rows = stats.recentSales.map(ticket => {
      const date = new Date(ticket.created_at).toLocaleDateString();
      const amount = ticket.events?.price || 0;
      const eventTitle = ticket.events?.title || "Unknown";

      return [
        ticket.id,
        `"${eventTitle.replace(/"/g, '""')}"`, // Escape quotes
        `"${(ticket.user_name || "N/A").replace(/"/g, '""')}"`,
        ticket.user_email,
        amount,
        ticket.status,
        date
      ].join(",");
    });

    // 3. Combine Headers and Rows
    const csvContent = [headers.join(","), ...rows].join("\n");

    // 4. Create Download Link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `flexpass_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-theme">Dashboard Overview</h2>
        <p className="text-theme-2">Welcome back, here is what's happening with your events.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Revenue */}
        <div className="p-6 rounded-2xl shadow-sm" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-theme-2 text-sm">Total Revenue</p>
          <h3 className="text-3xl font-bold text-theme mt-1">
            ₦{stats.revenue.toLocaleString()}
          </h3>
        </div>

        {/* Card 2: Tickets Sold */}
        <div className="p-6 rounded-2xl shadow-sm" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-[#480082]/10 rounded-lg">
              <Ticket className="h-6 w-6 text-[#480082]" />
            </div>
          </div>
          <p className="text-theme-2 text-sm">Tickets Sold</p>
          <h3 className="text-3xl font-bold text-theme mt-1">
            {stats.ticketsSold}
          </h3>
        </div>

        {/* Card 3: Events Active */}
        <div className="p-6 rounded-2xl shadow-sm" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-6 w-6 text-[#FFB700]" />
            </div>
          </div>
          <p className="text-theme-2 text-sm">Your Events</p>
          <h3 className="text-3xl font-bold text-theme mt-1">{stats.activeEvents}</h3>
        </div>
      </div>

      {/* Sales Analytics Chart */}
      <div className="p-6 rounded-2xl shadow-sm" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
        <h3 className="font-bold text-lg text-theme mb-2">Revenue by Event</h3>
        <p className="text-theme-2 text-sm mb-6">See which experiences are performing best.</p>
        <SalesChart data={(stats as any).chartData || []} />
      </div>

      {/* My Events Management */}
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg text-theme">My Events</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {stats.myEvents.length === 0 ? (
            <p className="p-6 text-theme-2 text-sm">You haven't created any events yet.</p>
          ) : (
            stats.myEvents.map((event: any) => (
              <div key={event.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-100 rounded-lg overflow-hidden relative">
                    {event.image_url && <img src={event.image_url} alt={event.title} className="object-cover w-full h-full" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-theme">{event.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-theme-2">
                      <Calendar size={12} />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/events/${event.id}/edit`)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-[#eDdedd] rounded-lg text-sm font-medium hover:bg-slate-100 hover:text-[#480082] transition-colors"
                >
                  <Edit size={14} />
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-theme">Recent Transactions</h3>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-theme-2">
            <thead className="text-xs uppercase font-medium" style={{backgroundColor:"var(--surface-raised)"}}>
              <tr>
                <th className="px-6 py-4">Event</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentSales.slice(0, 5).map((ticket) => (
                <tr key={ticket.id} className="transition">
                  <td className="px-6 py-4 font-medium text-theme">{(ticket as any).events?.title || "Unknown"}</td>
                  <td className="px-6 py-4">{ticket.user_email}</td>
                  <td className="px-6 py-4">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold">₦{((ticket as any).events?.price ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                      Paid
                    </span>
                  </td>
                </tr>
              ))}

              {stats.recentSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <p className="mb-2">You haven't sold any tickets yet.</p>
                      <p className="text-xs">Create an event to get started!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}