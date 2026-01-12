"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { DollarSign, Ticket, TrendingUp, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    ticketsSold: 0,
    activeEvents: 0,
    recentSales: [] as any[]
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

      console.log("👤 Logged in as:", user.email);

      // 2. Fetch EVENTS created by this user
      const { data: myEvents } = await supabase
        .from("events")
        .select("id, title, price")
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

      // 4. Calculate Stats
      const ticketsSold = myTickets?.length || 0;
      
      // Calculate Revenue
      const revenue = myTickets?.reduce((acc, ticket) => {
        // @ts-ignore
        return acc + (ticket.events?.price || 0);
      }, 0) || 0;

      setStats({
        revenue,
        ticketsSold,
        activeEvents: myEvents.length,
        recentSales: myTickets || []
      });
      
      setLoading(false);
    }

    loadDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#581c87]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500">Welcome back, here is what's happening with your events.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Revenue */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Total Revenue</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">
            ₦{stats.revenue.toLocaleString()}
          </h3>
        </div>

        {/* Card 2: Tickets Sold */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Ticket className="h-6 w-6 text-[#581c87]" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Tickets Sold</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">
            {stats.ticketsSold}
          </h3>
        </div>

        {/* Card 3: Events Active */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-6 w-6 text-[#f97316]" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Your Events</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.activeEvents}</h3>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-medium">
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
                <tr key={ticket.id} className="hover:bg-slate-50 transition">
                  {/* @ts-ignore */}
                  <td className="px-6 py-4 font-medium text-slate-900">{ticket.events?.title || "Unknown"}</td>
                  <td className="px-6 py-4">{ticket.user_email}</td>
                  <td className="px-6 py-4">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  {/* @ts-ignore */}
                  <td className="px-6 py-4 font-bold">₦{ticket.events?.price.toLocaleString()}</td>
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