"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Building2, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BankSettings() {
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function fetchBankDetails() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("bank_accounts")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (data) {
                setBankName(data.bank_name);
                setAccountNumber(data.account_number);
                setAccountName(data.account_name);
            }
            setLoading(false);
        }

        fetchBankDetails();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage("");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Updates or Insert via 'upsert' logic is tricky with unique constraints sometimes, 
        // but we made user_id unique in the schema, so we can use Upsert.

        // First check if exists to determine ID, OR just upsert on user_id conflict if table allows.
        // Our schema used 'UNIQUE(user_id)', so upsert works.

        const { error } = await supabase
            .from("bank_accounts")
            .upsert({
                user_id: user.id,
                bank_name: bankName,
                account_number: accountNumber,
                account_name: accountName
            }, { onConflict: 'user_id' });

        if (error) {
            console.error(error);
            setMessage("Failed to save bank details.");
        } else {
            setMessage("Bank details saved successfully!");
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
                    <label className="text-sm font-medium text-slate-600">Bank Name</label>
                    <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. GTBank, Zenith Bank"
                        className="rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Account Number</label>
                    <Input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="0123456789"
                        maxLength={10}
                        className="rounded-xl"
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Account Name</label>
                    <Input
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Account Holder Name"
                        className="rounded-xl"
                    />
                    <p className="text-xs text-slate-400">
                        Ensure this matches your bank account exactly to avoid payout delays.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
                    {message}
                </p>

                <Button
                    onClick={handleSave}
                    disabled={saving || !bankName || !accountNumber || !accountName}
                    className="bg-[#581c87] hover:bg-[#4c1d75] text-white"
                >
                    {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Bank Details
                </Button>
            </div>
        </div>
    );
}
