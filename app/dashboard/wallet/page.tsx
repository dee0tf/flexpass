"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, DollarSign, Lock, AlertCircle } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateBalance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get my events
      const { data: myEvents } = await supabase.from("events").select("id").eq("user_id", user.id);
      if (!myEvents || myEvents.length === 0) { setLoading(false); return; }

      const myEventIds = myEvents.map(e => e.id);

      // 2. Get tickets sold for my events
      const { data: tickets } = await supabase
        .from("tickets")
        .select("*, events(price)")
        .in("event_id", myEventIds)
        .eq("status", "valid");

      // 3. Sum up the price
      const total = tickets?.reduce((acc, ticket: any) => acc + (ticket.events?.price || 0), 0) || 0;
      setBalance(total);
      setLoading(false);
    }
    calculateBalance();
  }, []);

  if (loading) return <div className="p-10"><Loader2 className="animate-spin text-[#581c87]" /></div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Wallet & Payouts</h1>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-[#581c87] to-[#7c3aed] text-white p-8 rounded-2xl shadow-xl mb-8">
        <p className="text-purple-200 font-medium mb-1">Available Balance</p>
        <h2 className="text-4xl font-bold flex items-center">
          ₦{balance.toLocaleString()}
        </h2>
        <div className="mt-6 flex gap-3">
          <button className="bg-white text-[#581c87] px-6 py-2 rounded-lg font-bold hover:bg-purple-50 transition">
            Withdraw Funds
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-3">
        <AlertCircle className="text-orange-600 shrink-0" />
        <div>
          <h4 className="font-bold text-orange-800 text-sm">Payout Schedule</h4>
          <p className="text-orange-700 text-sm mt-1">
            FlexPass processes payouts every Friday. Ensure your bank details are updated in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}