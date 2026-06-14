"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  User, Loader2, Save, Lock, Bell, ShieldAlert,
  CheckCircle2, XCircle, Eye, EyeOff, LogOut, BadgeCheck,
} from "lucide-react";

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="px-6 py-5 border-b" style={{ borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {description && <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled, type = "text" }: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-3 rounded-xl text-sm transition focus:outline-none focus:ring-2"
      style={{
        backgroundColor: disabled ? "var(--surface-raised)" : "var(--card-bg)",
        border: "1px solid var(--card-border)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        opacity: disabled ? 0.7 : 1,
      }}
    />
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl mt-4
      ${type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
      {type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Notifications
  const [notifySale, setNotifySale] = useState(true);
  const [notifyPayout, setNotifyPayout] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      setEmail(user.email || "");
      setFullName(user.user_metadata?.full_name || "");
      setOrganizerName(user.user_metadata?.organizer_name || "");
      setNotifySale(user.user_metadata?.notify_sale !== false);
      setNotifyPayout(user.user_metadata?.notify_payout !== false);

      // Check verified status
      const { data } = await supabase
        .from("events")
        .select("organizer_verified")
        .eq("user_id", user.id)
        .eq("organizer_verified", true)
        .limit(1);
      setVerified((data?.length || 0) > 0);
      setLoading(false);
    });
  }, []);

  const initials = (fullName || email).slice(0, 2).toUpperCase();

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, organizer_name: organizerName || fullName },
    });
    setProfileMsg(error
      ? { text: "Failed to save profile.", type: "error" }
      : { text: "Profile updated.", type: "success" }
    );
    setSavingProfile(false);
  }

  async function handleChangePassword() {
    setPasswordMsg(null);
    if (newPassword.length < 8) {
      setPasswordMsg({ text: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ text: error.message || "Failed to update password.", type: "error" });
    } else {
      setPasswordMsg({ text: "Password updated. You may need to log in again on other devices.", type: "success" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  }

  async function handleSaveNotifs() {
    setSavingNotifs(true);
    setNotifMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: { notify_sale: notifySale, notify_payout: notifyPayout },
    });
    setNotifMsg(error
      ? { text: "Failed to save preferences.", type: "error" }
      : { text: "Notification preferences saved.", type: "success" }
    );
    setSavingNotifs(false);
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut({ scope: "global" });
    window.location.replace("/login");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Account Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Manage your profile, security, and preferences.</p>
      </div>

      {/* ── Profile ── */}
      <SectionCard title="Profile" description="Your name and display info shown on events and tickets.">
        <div className="space-y-5">
          {/* Avatar + badge */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#480082,#9F67FE)" }}>
              {initials}
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{fullName || "—"}</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{email}</p>
              {verified && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                  <BadgeCheck size={11} /> Verified Host
                </span>
              )}
            </div>
          </div>

          <Field label="Full Name">
            <TextInput value={fullName} onChange={setFullName} placeholder="Your full name" />
          </Field>

          <Field label="Organizer Display Name" hint="Shown on your event pages and tickets. Defaults to your full name.">
            <TextInput value={organizerName} onChange={setOrganizerName} placeholder="e.g. Lagos Vibes Collective" />
          </Field>

          <Field label="Email Address" hint="Email cannot be changed. Contact support if needed.">
            <TextInput value={email} disabled />
          </Field>

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            {profileMsg && <Toast message={profileMsg.text} type={profileMsg.type} />}
            <div className="ml-auto">
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Password ── */}
      <SectionCard title="Change Password" description="Use a strong password you don't use elsewhere.">
        <div className="space-y-4">
          <Field label="New Password">
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 pr-12 py-3 rounded-xl text-sm transition focus:outline-none focus:ring-2"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
              />
              <button type="button" onClick={() => setShowNewPw(p => !p)}
                className="absolute right-3 top-3.5 transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}>
                {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          <Field label="Confirm New Password">
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="w-full px-4 pr-12 py-3 rounded-xl text-sm transition focus:outline-none focus:ring-2"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
              />
              <button type="button" onClick={() => setShowConfirmPw(p => !p)}
                className="absolute right-3 top-3.5 transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}>
                {showConfirmPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {passwordMsg && <Toast message={passwordMsg.text} type={passwordMsg.type} />}

          <div className="flex justify-end pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            <button onClick={handleChangePassword} disabled={savingPassword || !newPassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Update Password
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notification Preferences" description="Choose which email notifications you receive.">
        <div className="space-y-4">
          {[
            { key: "sale", label: "New ticket sale", desc: "Get an email each time someone buys a ticket to your event.", value: notifySale, set: setNotifySale },
            { key: "payout", label: "Payout updates", desc: "Get notified when a withdrawal is approved or rejected.", value: notifyPayout, set: setNotifyPayout },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-4 cursor-pointer p-4 rounded-xl transition"
              style={{ backgroundColor: "var(--surface-raised)" }}>
              <div className="mt-0.5">
                <input type="checkbox" checked={item.value} onChange={e => item.set(e.target.checked)}
                  className="sr-only" />
                <div onClick={() => item.set(!item.value)}
                  className="h-5 w-9 rounded-full relative transition-colors cursor-pointer"
                  style={{ backgroundColor: item.value ? "var(--brand-indigo)" : "var(--card-border)" }}>
                  <div className="absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-all"
                    style={{ left: item.value ? "calc(100% - 18px)" : "2px" }} />
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
              </div>
            </label>
          ))}

          {notifMsg && <Toast message={notifMsg.text} type={notifMsg.type} />}

          <div className="flex justify-end pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            <button onClick={handleSaveNotifs} disabled={savingNotifs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              {savingNotifs ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
              Save Preferences
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Danger Zone ── */}
      <SectionCard title="Danger Zone">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Sign out of all devices</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ends every active session across all browsers and devices.</p>
            </div>
            <button onClick={handleSignOutAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 bg-red-600 shrink-0 ml-4">
              <LogOut size={14} /> Sign Out All
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Delete account</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Permanently removes your account and all events. This cannot be undone.</p>
            </div>
            <a href="mailto:flexpasshome@gmail.com?subject=Account%20Deletion%20Request"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90 shrink-0 ml-4"
              style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.25)" }}>
              <ShieldAlert size={14} /> Request Deletion
            </a>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
