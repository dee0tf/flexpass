"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle, LogOut, KeyRound, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CheckInScanner, { CheckInEvent } from "@/components/CheckInScanner";

export default function AdminCheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [events, setEvents] = useState<CheckInEvent[]>([]);
  const [codeEventId, setCodeEventId] = useState("");
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const checkAuth = () => {
      setLoading(true);
      setAuthorized(false);
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) { setLoading(false); return; }
        const res = await fetch("/api/admin/check-auth", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) { setLoading(false); return; }
        setAuthorized(true);

        const { data } = await supabase
          .from("events")
          .select("id, title, date, organizer_name")
          .order("date", { ascending: false });
        setEvents(data || []);
        setLoading(false);
      });
    };

    checkAuth();

    // Re-verify on bfcache restore (e.g. swiping back on iOS Safari after
    // signing out) so a cached authorized render can't linger post-logout.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkAuth();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // scan_code lives in event_scan_codes now (RLS-locked, service-role only)
  // — fetch it fresh via the admin API whenever the selected event changes,
  // rather than pulling it in with the events list.
  useEffect(() => {
    if (!codeEventId) { setCurrentCode(null); return; }
    setCodeLoading(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setCodeLoading(false); return; }
      try {
        const res = await fetch(`/api/admin/generate-scan-code?eventId=${codeEventId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setCurrentCode(res.ok ? (data.code ?? null) : null);
      } catch {
        setCurrentCode(null);
      } finally {
        setCodeLoading(false);
      }
    });
  }, [codeEventId]);

  const handleGenerateScanCode = async () => {
    if (!codeEventId) return;
    setCodeBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/admin/generate-scan-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId: codeEventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      setCurrentCode(data.code);
      setLinkCopied(false);
    } catch {
      // Silently no-op on failure — the button staying in its "generate"
      // state is signal enough that nothing changed; this panel is a small
      // convenience tool, not a flow worth a full toast/error system for.
    } finally {
      setCodeBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)" }}>You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div>
          <h1 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Admin Check-In</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Scan tickets for any event on the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin"
            className="text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
            style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
            ← Admin Panel
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition hover:opacity-80 text-red-500 hover:bg-red-500/10">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <KeyRound className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
            Door Staff Access Codes
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Generate a scan-only code for any host&apos;s event — useful when FlexPass is running the door directly.
          </p>
          <select
            value={codeEventId}
            onChange={e => { setCodeEventId(e.target.value); setLinkCopied(false); }}
            className="w-full mt-3 p-2.5 rounded-xl text-sm"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}>
            <option value="">— choose an event —</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.title} — {new Date(ev.date).toLocaleDateString()}
                {ev.organizer_name ? ` (${ev.organizer_name})` : ""}
              </option>
            ))}
          </select>

          {codeEventId && (
            <div className="mt-3 space-y-2">
              {codeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
              ) : currentCode && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-widest px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}>
                    {currentCode}
                  </span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/checkin/${codeEventId}`);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                    style={{ backgroundColor: "var(--surface)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
                    {linkCopied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy scanner link</>}
                  </button>
                </div>
              )}
              <button onClick={handleGenerateScanCode} disabled={codeBusy}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--card-border)" }}>
                {codeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                {currentCode ? "Regenerate code" : "Generate code"}
              </button>
            </div>
          )}
        </div>

        <CheckInScanner
          events={events}
          title="Admin Check-In Scanner"
          subtitle="Pick the event you're running the door for, then scan."
        />
      </div>
    </div>
  );
}
