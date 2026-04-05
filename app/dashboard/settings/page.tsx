"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        setFullName(user.user_metadata?.full_name || "");
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (error) {
      setMessage("Error updating profile.");
    } else {
      setMessage("Profile updated successfully!");
    }
    setSaving(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Account Settings</h1>

      <div className="p-6 rounded-xl shadow-sm space-y-6" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 bg-[#480082]/10 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-[#480082]" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{fullName || "User"}</h3>
            <p className="text-sm text-slate-500">{email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your name"
              className="rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input
              type="text"
              value={email}
              disabled
              className="rounded-lg bg-slate-50 text-slate-500"
            />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
          <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#480082] hover:bg-[#3a006b] text-white"
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}