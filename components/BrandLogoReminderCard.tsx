"use client";

import { useState } from "react";
import { Loader2, Mail, Send, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "preview" | "test" | "send";

// Admin "Hosts" tab: emails every host without a brand logo, inviting them
// to upload one for the homepage Trusted by slider. Preview -> test -> send,
// with an inline confirm before the real send.
export default function BrandLogoReminderCard() {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(mode: Mode) {
    setBusy(mode);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Signed out — sign in again");
      const res = await fetch("/api/admin/brand-logo-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (mode === "preview") {
        setCount(data.count);
      } else if (mode === "test") {
        setMsg({ text: `Test email sent to ${data.to}.`, ok: true });
      } else {
        setConfirming(false);
        setCount(null);
        setMsg({
          text: `Sent to ${data.sent} of ${data.total} host${data.total === 1 ? "" : "s"}${data.failed ? ` — ${data.failed} failed` : ""}.`,
          ok: !data.failed,
        });
      }
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Something went wrong", ok: false });
    } finally {
      setBusy(null);
    }
  }

  const btn = "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-50";

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(72,0,130,0.1)" }}>
          <Mail size={18} style={{ color: "var(--brand-indigo)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Ask hosts for their brand logo</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Emails every host who hasn&apos;t uploaded a logo yet, inviting them to add one for the homepage Trusted by slider.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button onClick={() => run("preview")} disabled={!!busy} className={btn}
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
              {busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Count recipients
            </button>
            <button onClick={() => run("test")} disabled={!!busy} className={btn}
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
              {busy === "test" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send test to me
            </button>
            {count !== null && count > 0 && !confirming && (
              <button onClick={() => setConfirming(true)} disabled={!!busy} className={`${btn} text-white`}
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                <Send size={14} /> Send to {count} host{count === 1 ? "" : "s"}
              </button>
            )}
          </div>

          {count === 0 && (
            <p className="text-xs mt-3 font-semibold text-green-600">Every host already has a logo — nobody to email.</p>
          )}

          {confirming && count !== null && (
            <div className="mt-3 p-3 rounded-xl flex flex-wrap items-center gap-3"
              style={{ backgroundColor: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)" }}>
              <p className="text-xs font-semibold text-amber-700 flex-1 min-w-[12rem]">
                This emails {count} real host{count === 1 ? "" : "s"} now and can&apos;t be undone.
              </p>
              <button onClick={() => run("send")} disabled={!!busy} className={`${btn} text-white`} style={{ backgroundColor: "#d97706" }}>
                {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Yes, send
              </button>
              <button onClick={() => setConfirming(false)} disabled={!!busy} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
            </div>
          )}

          {msg && (
            <p className={`text-xs mt-3 font-semibold ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
