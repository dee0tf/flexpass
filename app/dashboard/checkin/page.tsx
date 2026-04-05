"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Camera, Keyboard } from "lucide-react";

interface ScanResult {
  valid: boolean | null;
  reason?: string;
  holder?: string;
  email?: string;
  tier?: string;
  checkedInAt?: string;
}

export default function CheckInPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualId, setManualId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerStarted = useRef(false);

  // Load organiser's events
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("events")
        .select("id, title, date")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      setEvents(data || []);
      if (data && data.length === 1) setSelectedEvent(data[0].id);
    })();
  }, []);

  const doCheckIn = useCallback(async (ticketId: string) => {
    if (!selectedEvent || loading) return;
    setLoading(true);
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticketId: ticketId.trim(), eventId: selectedEvent }),
      });
      const data = await res.json();
      setResult({ valid: res.ok && data.valid, ...data });
    } catch {
      setResult({ valid: false, reason: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, loading]);

  // Camera scanner
  useEffect(() => {
    if (mode !== "camera" || !selectedEvent || scannerStarted.current) return;

    let html5QrCode: any = null;
    scannerStarted.current = true;
    setScanning(true);

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Extract ticket ID from URL or raw value
          let ticketId = decodedText;
          try {
            const url = new URL(decodedText);
            ticketId = url.searchParams.get("t") || decodedText;
          } catch { /* not a URL, use raw value */ }

          doCheckIn(ticketId);
        },
        () => { /* scan error - ignore, keep scanning */ }
      ).catch(() => {
        setScanning(false);
        scannerStarted.current = false;
      });
    });

    return () => {
      if (html5QrCode) {
        html5QrCode.stop().catch(() => {}).finally(() => {
          scannerStarted.current = false;
          setScanning(false);
        });
      }
    };
  }, [mode, selectedEvent, doCheckIn]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) doCheckIn(manualId.trim());
  };

  const resultBg = result?.valid === true ? "#16a34a"
    : result?.reason?.includes("Already") ? "#d97706"
    : "#dc2626";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme">Check-In Scanner</h1>
        <p className="text-theme-2 text-sm">Scan or enter a ticket ID to admit guests.</p>
      </div>

      {/* Event selector */}
      <div>
        <label className="block text-sm font-medium text-theme-2 mb-1">Select Event</label>
        <select
          value={selectedEvent}
          onChange={e => { setSelectedEvent(e.target.value); setResult(null); }}
          className="w-full p-3 rounded-xl text-sm"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
        >
          <option value="">— choose an event —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {new Date(ev.date).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
            {(["camera", "manual"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); scannerStarted.current = false; }}
                className="flex-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition"
                style={{
                  backgroundColor: mode === m ? "var(--brand-indigo)" : "var(--surface)",
                  color: mode === m ? "#fff" : "var(--text-secondary)",
                }}
              >
                {m === "camera" ? <Camera size={15} /> : <Keyboard size={15} />}
                {m === "camera" ? "Scan QR" : "Enter ID"}
              </button>
            ))}
          </div>

          {/* Camera view */}
          {mode === "camera" && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <div id="qr-reader" className="w-full" />
              {!scanning && (
                <p className="p-4 text-center text-sm text-theme-2">
                  Camera starting… allow camera access if prompted.
                </p>
              )}
            </div>
          )}

          {/* Manual entry */}
          {mode === "manual" && (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="Paste ticket ID…"
                className="flex-1 p-3 rounded-xl text-sm"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
              />
              <button
                type="submit"
                disabled={loading || !manualId.trim()}
                className="px-5 py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-indigo)" }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Check In"}
              </button>
            </form>
          )}

          {/* Result card */}
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
            </div>
          )}

          {result && !loading && (
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 text-white text-center" style={{ backgroundColor: resultBg }}>
                {result.valid
                  ? <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                  : result.reason?.includes("Already")
                  ? <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                  : <XCircle className="h-12 w-12 mx-auto mb-2" />
                }
                <h2 className="text-xl font-bold">
                  {result.valid ? "Access Granted ✓"
                    : result.reason?.includes("Already") ? "Already Checked In"
                    : "Access Denied"}
                </h2>
                {result.reason && <p className="text-sm mt-1 opacity-80">{result.reason}</p>}
              </div>

              {(result.holder || result.tier) && (
                <div className="p-5 space-y-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  {result.holder && <InfoRow label="Name" value={result.holder} />}
                  {result.email && <InfoRow label="Email" value={result.email} />}
                  {result.tier && <InfoRow label="Ticket Type" value={result.tier} />}
                  {result.checkedInAt && (
                    <InfoRow label="Checked In" value={new Date(result.checkedInAt).toLocaleTimeString()} />
                  )}
                  <button
                    onClick={() => { setResult(null); setManualId(""); }}
                    className="mt-3 w-full py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition"
                    style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}
                  >
                    Scan Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
