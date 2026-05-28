"use client";

import { useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2, Send, ArrowLeft, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function EmailAttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are required.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const res = await fetch("/api/send-event-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send"); return; }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "rgba(72,0,130,0.1)" }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: "var(--brand-indigo)" }} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2 text-theme">Email Sent!</h2>
          <p className="text-theme-2 text-sm mb-6">
            Successfully delivered to <strong>{result.sent}</strong> of <strong>{result.total}</strong> attendees.
            {result.failed > 0 && ` ${result.failed} failed.`}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setSubject(""); setMessage(""); }}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}
            >
              Send Another
            </button>
            <Link
              href={`/dashboard/events/${eventId}/edit`}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white text-center transition hover:opacity-90"
              style={{ backgroundColor: "var(--brand-indigo)" }}
            >
              Back to Event
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/events/${eventId}/edit`}
          className="p-2 rounded-xl transition hover:opacity-70"
          style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-theme">Email Attendees</h1>
          <p className="text-xs text-theme-2 mt-0.5">Send a message to everyone who has a ticket for this event</p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--card-border)", backgroundColor: "var(--surface-raised)" }}>
          <Users size={15} style={{ color: "var(--brand-lavender)" }} />
          <span className="text-sm font-medium text-theme-2">All valid ticket holders will receive this email</span>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-theme">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Important update about your ticket"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
              style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
            />
            <p className="text-xs mt-1 text-right text-theme-2">{subject.length}/120</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-theme">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message to attendees here. Let them know about venue changes, schedule updates, what to bring, or any other important details."
              rows={7}
              maxLength={2000}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition resize-none"
              style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
            />
            <p className="text-xs mt-1 text-right text-theme-2">{message.length}/2000</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand-indigo)" }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {sending ? "Sending…" : "Send to All Attendees"}
          </button>
        </div>
      </div>
    </div>
  );
}
