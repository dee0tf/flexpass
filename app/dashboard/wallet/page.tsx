"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw, AlertCircle, DollarSign, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BankSettings from "@/components/BankSettings";
import { Toast, ToastState, ToastType } from "@/components/Toast";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending Review", color: "bg-yellow-100 text-yellow-700" },
  processing: { label: "Processing",     color: "bg-blue-100 text-blue-700"   },
  paid:       { label: "Paid",           color: "bg-green-100 text-green-700"  },
  rejected:   { label: "Rejected",       color: "bg-red-100 text-red-700"     },
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankingDetails, setBankingDetails] = useState<any>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    loadWalletData();
  }, []);

  async function loadWalletData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const { data: myEvents } = await supabase.from("events").select("id").eq("user_id", user.id);
    const myEventIds = myEvents?.map(e => e.id) || [];

    const { data: tickets } = await supabase
      .from("tickets")
      .select("*, events(price)")
      .in("event_id", myEventIds.length > 0 ? myEventIds : ["__none__"])
      .in("status", ["valid", "scanned"]);

    const totalRevenue = tickets?.reduce((acc, ticket: any) => acc + (ticket.events?.price || 0), 0) || 0;

    const { data: myPayouts } = await supabase
      .from("payouts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setPayouts(myPayouts || []);

    // Pending + processing + paid all count against balance to prevent double-withdrawal
    const totalWithdrawn = myPayouts
      ?.filter(p => p.status !== "rejected")
      .reduce((acc, p) => acc + p.amount, 0) || 0;

    setBalance(Math.max(0, totalRevenue - totalWithdrawn));

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
      showToast("Please save your bank details first.", "warning");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 1000) {
      showToast("Minimum withdrawal is ₦1,000", "warning");
      return;
    }
    if (amount > balance) {
      showToast("Insufficient balance", "warning");
      return;
    }

    setWithdrawLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const { error } = await supabase.from("payouts").insert({
        user_id: session.user.id,
        amount,
        status:  "pending",
      });

      if (error) throw error;

      await loadWalletData();

      setWithdrawSuccess(true);
      setWithdrawAmount("");

      setTimeout(() => {
        setIsWithdrawOpen(false);
        setWithdrawSuccess(false);
      }, 2200);
    } catch (err: any) {
      showToast("Request failed: " + err.message, "error");
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (loading) return <div className="p-10"><Loader2 className="animate-spin text-[#480082]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Wallet & Payouts</h1>
        <p style={{ color: "var(--text-muted)" }}>Manage your earnings and withdraw to your bank.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT: Balance & History */}
        <div className="space-y-8">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-[#480082] to-[#9F67FE] text-white p-8 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#9F67FE]/70 font-medium mb-1">Available Balance</p>
                <h2 className="text-4xl font-bold">₦{balance.toLocaleString()}</h2>
              </div>
              <button onClick={loadWalletData} className="text-purple-300 hover:text-white transition">
                <RefreshCw size={20} />
              </button>
            </div>
            <div className="mt-8">
              <button
                onClick={() => { setWithdrawSuccess(false); setIsWithdrawOpen(true); }}
                className="bg-white text-[#480082] px-6 py-3 rounded-xl font-bold hover:bg-[#480082]/5 transition shadow-lg w-full md:w-auto"
              >
                Withdraw Funds
              </button>
            </div>
          </div>

          {/* Withdrawal History */}
          <div className="rounded-2xl shadow-sm overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: "var(--card-border)" }}>
              <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Withdrawal History</h3>
              <button onClick={loadWalletData}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition hover:opacity-80"
                style={{ backgroundColor: "rgba(72,0,130,0.07)", color: "var(--brand-indigo)" }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto" style={{ backgroundColor: "var(--card-bg)" }}>
              {payouts.length === 0 ? (
                <p className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  No withdrawals yet.
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase sticky top-0"
                    style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p, i) => {
                      const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                      return (
                        <tr key={p.id}
                          style={{ borderBottom: i < payouts.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                          <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                            {new Date(p.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                            ₦{p.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Status legend */}
            <div className="px-5 py-3 border-t text-xs flex flex-wrap gap-3"
              style={{ borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
              {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
                <span key={cfg.label} className={`px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {cfg.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Bank Settings + Info */}
        <div>
          <BankSettings />

          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-3 mt-6">
            <AlertCircle className="text-orange-600 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="font-bold text-orange-800 text-sm">Payout Schedule</h4>
              <p className="text-orange-700 text-sm mt-1">
                FlexPass processes payouts T+1 (next business day after request approval). Ensure your bank details are correct.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      <Dialog open={isWithdrawOpen} onOpenChange={(open) => {
        if (!open) { setWithdrawSuccess(false); setWithdrawAmount(""); }
        setIsWithdrawOpen(open);
      }}>
        <DialogContent className="rounded-2xl" style={{ backgroundColor: "var(--card-bg)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--text-primary)" }}>Request Withdrawal</DialogTitle>
            <DialogDescription style={{ color: "var(--text-muted)" }}>
              Available Balance: ₦{balance.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {withdrawSuccess ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>Request Submitted!</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Your withdrawal is pending review. FlexPass will process it on the next business day.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Amount to withdraw
                </label>
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
                  Will be sent to:{" "}
                  <span className="font-bold">{bankingDetails.bank_name} · {bankingDetails.account_number}</span>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                Your request will be reviewed and processed by FlexPass within 24 hours (T+1).
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) > balance || parseFloat(withdrawAmount) < 1000 || !bankingDetails}
                className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-6 text-lg"
              >
                {withdrawLoading ? <Loader2 className="animate-spin" /> : "Submit Withdrawal Request"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
