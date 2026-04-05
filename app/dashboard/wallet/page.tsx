"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw, AlertCircle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BankSettings from "@/components/BankSettings";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Withdrawal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankingDetails, setBankingDetails] = useState<any>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);

  useEffect(() => {
    loadWalletData();
  }, []);

  async function loadWalletData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get my events
    const { data: myEvents } = await supabase.from("events").select("id").eq("user_id", user.id);
    const myEventIds = myEvents?.map(e => e.id) || [];

    // 2. Get TOTAL sales (Gross Sales before fees are removed? Or just ticket price?)
    // Our plan: "Creator Revenue" = Ticket Price. "Fees" = Extra charge.
    // So if ticket is 1000, user paid 1050. Creator gets 1000.
    // We sum 'events(price)' or 'tickets(price)'?
    // We should rely on ticket sales count * event price.

    // FETCH TICKETS
    const { data: tickets } = await supabase
      .from("tickets")
      .select("*, events(price)")
      .in("event_id", myEventIds)
      .eq("status", "valid");

    const totalRevenue = tickets?.reduce((acc, ticket: any) => acc + (ticket.events?.price || 0), 0) || 0;

    // 3. Get Previous Payouts (Approved/Paid ones reduce balance? Or just show all?)
    // For a real ledger, Balance = Revenue - Payouts.
    const { data: myPayouts } = await supabase
      .from("payouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setPayouts(myPayouts || []);

    const totalWithdrawn = myPayouts
      ?.filter(p => p.status !== 'rejected') // Count pending and paid against balance to prevent double withdraw
      .reduce((acc, p) => acc + p.amount, 0) || 0;

    setBalance(Math.max(0, totalRevenue - totalWithdrawn));

    // 4. Check Bank Details
    const { data: bank } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setBankingDetails(bank);

    setLoading(false);
  }

  const handleWithdraw = async () => {
    if (!bankingDetails) {
      alert("Please save your bank details first.");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 1000) {
      alert("Minimum withdrawal is ₦1,000");
      return;
    }

    if (amount > balance) {
      alert("Insufficient balance");
      return;
    }

    setWithdrawLoading(true);
    try {
      // Get session token to authenticate the server-side transfer API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Please log in again."); return; }

      const res = await fetch('/api/paystack/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert("Withdrawal failed: " + result.error);
      } else {
        alert(result.message || "Withdrawal initiated successfully!");
        setIsWithdrawOpen(false);
        setWithdrawAmount("");
        loadWalletData();
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (loading) return <div className="p-10"><Loader2 className="animate-spin text-[#480082]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet & Payouts</h1>
        <p className="text-slate-500">Manage your earnings and withdraw to your bank.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT COLUMN: Balance & Withdraw */}
        <div className="space-y-8">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-[#480082] to-[#9F67FE] text-white p-8 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#9F67FE]/70 font-medium mb-1">Available Balance</p>
                <h2 className="text-4xl font-bold flex items-center">
                  ₦{balance.toLocaleString()}
                </h2>
              </div>
              <button onClick={loadWalletData} className="text-purple-300 hover:text-white transition">
                <RefreshCw size={20} />
              </button>
            </div>

            <div className="mt-8">
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="bg-white text-[#480082] px-6 py-3 rounded-xl font-bold hover:bg-[#480082]/5 transition shadow-lg w-full md:w-auto"
              >
                Withdraw Funds
              </button>
            </div>
          </div>

          {/* Payout History */}
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900">Withdrawal History</h3>
            </div>
            <div className="max-h-60 overflow-y-auto" style={{backgroundColor:"var(--card-bg)"}}>
              {payouts.length === 0 ? (
                <p className="p-6 text-center text-slate-500 text-sm">No withdrawals yet.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium">₦{p.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize
                                                ${p.status === 'paid' ? 'bg-green-100 text-green-700' :
                              p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Bank Settings */}
        <div>
          <BankSettings />

          {/* Info Section */}
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-3 mt-6">
            <AlertCircle className="text-orange-600 shrink-0" />
            <div>
              <h4 className="font-bold text-orange-800 text-sm">Payout Schedule</h4>
              <p className="text-orange-700 text-sm mt-1">
                FlexPass processes payouts every Friday. Ensure your bank details are correct.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Available Balance: ₦{balance.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount to withdraw</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-slate-400 h-5 w-5" />
                <Input
                  type="number"
                  className="pl-10 text-lg font-bold"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
            </div>

            {!bankingDetails ? (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                You must save your bank details before withdrawing.
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600">
                Will be sent to: <span className="font-bold">{bankingDetails.bank_name} - {bankingDetails.account_number}</span>
              </div>
            )}

            <Button
              onClick={handleWithdraw}
              disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) > balance || !bankingDetails}
              className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-6 text-lg"
            >
              {withdrawLoading ? <Loader2 className="animate-spin" /> : "Confirm Withdrawal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}