"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Building2, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Common Nigerian bank codes (Paystack codes)
const NIGERIAN_BANKS = [
    { name: "Access Bank", code: "044" },
    { name: "Citibank", code: "023" },
    { name: "Diamond Bank", code: "063" },
    { name: "Ecobank Nigeria", code: "050" },
    { name: "Fidelity Bank", code: "070" },
    { name: "First Bank of Nigeria", code: "011" },
    { name: "First City Monument Bank", code: "214" },
    { name: "Globus Bank", code: "00103" },
    { name: "Guaranty Trust Bank", code: "058" },
    { name: "Heritage Bank", code: "030" },
    { name: "Keystone Bank", code: "082" },
    { name: "Kuda Bank", code: "50211" },
    { name: "Moniepoint MFB", code: "50515" },
    { name: "OPay", code: "999992" },
    { name: "PalmPay", code: "999991" },
    { name: "Polaris Bank", code: "076" },
    { name: "Providus Bank", code: "101" },
    { name: "Stanbic IBTC Bank", code: "221" },
    { name: "Standard Chartered", code: "068" },
    { name: "Sterling Bank", code: "232" },
    { name: "Titan Bank", code: "102" },
    { name: "Union Bank of Nigeria", code: "032" },
    { name: "United Bank For Africa", code: "033" },
    { name: "Unity Bank", code: "215" },
    { name: "VFD Micro Finance Bank", code: "566" },
    { name: "Wema Bank", code: "035" },
    { name: "Zenith Bank", code: "057" },
];

export default function BankSettings() {
    const [bankCode, setBankCode] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    // Prevent auto-verify from firing when we populate fields from saved DB data
    const skipNextVerify = useRef(false);

    useEffect(() => {
        async function fetchBankDetails() {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { data } = await supabase
                .from("bank_accounts")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (data) {
                skipNextVerify.current = true;
                setBankCode(data.bank_code || "");
                setAccountNumber(data.account_number || "");
                setAccountName(data.account_name || "");
                if (data.account_name) setVerified(true);
            }
            setLoading(false);
        }
        fetchBankDetails();
    }, []);

    // Auto-verify account when both bank code and 10-digit account number are present
    useEffect(() => {
        if (skipNextVerify.current) {
            skipNextVerify.current = false;
            return;
        }
        if (bankCode && accountNumber.length === 10) {
            verifyAccount();
        } else {
            setVerified(false);
            setAccountName("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bankCode, accountNumber]);

    const verifyAccount = async () => {
        if (!bankCode || accountNumber.length !== 10) return;
        setVerifying(true);
        setVerified(false);
        setAccountName("");
        try {
            const res = await fetch(
                `/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}`
            );
            const data = await res.json();
            if (res.ok && data.account_name) {
                setAccountName(data.account_name);
                setVerified(true);
            } else {
                setAccountName("");
                setMessage("Could not verify account. Please check the details.");
            }
        } catch {
            setMessage("Verification failed. Please try again.");
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async () => {
        if (!verified || !accountName) {
            setMessage("Please verify your account number first.");
            return;
        }
        setSaving(true);
        setMessage("");

        const { data: { session: saveSession } } = await supabase.auth.getSession();
        const user = saveSession?.user;
        if (!user) return;

        const selectedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);

        const { error } = await supabase
            .from("bank_accounts")
            .upsert({
                user_id: user.id,
                bank_name: selectedBank?.name || bankCode,
                bank_code: bankCode,
                account_number: accountNumber,
                account_name: accountName,
                recipient_code: null, // Reset recipient code when bank details change
            }, { onConflict: 'user_id' });

        if (error) {
            setMessage("Failed to save bank details.");
        } else {
            setMessage("Bank details saved! Registering with Paystack...");

            // Register host as a Paystack subaccount so payments auto-split
            if (saveSession) {
                const res = await fetch('/api/paystack/subaccount', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${saveSession.access_token}` },
                });
                if (res.ok) {
                    setMessage("Bank details saved & verified with Paystack ✓");
                } else {
                    // Not fatal — subaccount can be retried next save
                    setMessage("Bank details saved. Paystack registration pending.");
                }
            } else {
                setMessage("Bank details saved successfully!");
            }
        }
        setSaving(false);
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Building2 className="text-[#581c87]" />
                Bank Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Bank</label>
                    <select
                        value={bankCode}
                        onChange={(e) => setBankCode(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#480082] focus:outline-none"
                    >
                        <option value="">Select your bank</option>
                        {NIGERIAN_BANKS.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Account Number</label>
                    <Input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0123456789"
                        maxLength={10}
                        className="rounded-xl"
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Account Name</label>
                    <div className="relative">
                        <Input
                            value={verifying ? "Verifying..." : accountName}
                            readOnly
                            placeholder="Auto-filled after verification"
                            className={`rounded-xl bg-slate-50 ${verified ? "border-green-400 text-green-700 font-medium" : ""}`}
                        />
                        {verifying && (
                            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />
                        )}
                        {verified && !verifying && (
                            <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                        )}
                    </div>
                    <p className="text-xs text-slate-400">
                        Account name is automatically verified via your bank.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
                    {message}
                </p>

                <Button
                    onClick={handleSave}
                    disabled={saving || !verified || !accountName}
                    className="bg-[#581c87] hover:bg-[#4c1d75] text-white"
                >
                    {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Bank Details
                </Button>
            </div>
        </div>
    );
}
