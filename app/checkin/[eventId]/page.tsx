"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import CheckInScanner from "@/components/CheckInScanner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageKey = (eventId: string) => `flexpass_scan_code_${eventId}`;

interface VerifiedEvent {
  title: string;
  date: string;
}

/**
 * Door-staff entry point — a host shares this URL (plus the access code
 * from the event editor) with whoever is running check-in, so they never
 * need the host's own login. The code is verified once against
 * /api/scanner-auth, cached in this browser via localStorage so it isn't
 * re-typed on every reload, and then handed straight through to the shared
 * CheckInScanner component for the actual scanning.
 */
export default function ScannerAccessPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params?.eventId;
  const invalidLink = !eventId || !UUID_RE.test(eventId);

  const [checking, setChecking] = useState(!invalidLink);
  const [code, setCode] = useState<string | null>(null);
  const [event, setEvent] = useState<VerifiedEvent | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const verify = useCallback(async (candidate: string) => {
    setError("");
    try {
      const res = await fetch("/api/scanner-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, code: candidate }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try { localStorage.setItem(storageKey(eventId!), candidate); } catch { /* private browsing, etc. */ }
        setCode(candidate);
        setEvent({ title: data.title, date: data.date });
        return true;
      }
      try { localStorage.removeItem(storageKey(eventId!)); } catch { /* ignore */ }
      setError(data.error || "Incorrect access code");
      return false;
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      return false;
    }
  }, [eventId]);

  useEffect(() => {
    if (invalidLink) return;
    (async () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(storageKey(eventId)); } catch { /* ignore */ }
      if (saved) await verify(saved);
      setChecking(false);
    })();
  }, [eventId, invalidLink, verify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    await verify(input.trim());
    setSubmitting(false);
  };

  if (invalidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Invalid check-in link.</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  if (!code || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <form onSubmit={handleSubmit}
          className="max-w-sm w-full rounded-3xl p-6 shadow-xl"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-color)" }}>
          <div className="flex flex-col items-center text-center mb-5">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: "rgba(72,0,130,0.1)" }}>
              <KeyRound className="h-6 w-6" style={{ color: "var(--brand-indigo)" }} />
            </div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Door Staff Access</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Enter the access code given to you by the event host.
            </p>
          </div>
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Access code"
            className="w-full p-3 rounded-xl text-sm text-center font-mono tracking-widest"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
          />
          {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
          <button type="submit" disabled={!input.trim() || submitting}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-lg mx-auto mb-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        <ShieldCheck size={13} style={{ color: "#16a34a" }} /> Access code verified for {event.title}
      </div>
      <CheckInScanner
        events={[{ id: eventId!, title: event.title, date: event.date }]}
        scanCode={code}
        title="Door Scanner"
        subtitle="Each QR can only be admitted once — re-scans are blocked."
      />
    </div>
  );
}
