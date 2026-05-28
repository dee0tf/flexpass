"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Camera, Keyboard, ScanLine, ShieldAlert } from "lucide-react";

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

  // Refs for synchronous guards — prevents race conditions that state can't stop
  const scannerRef = useRef<any>(null);
  const scannerStarted = useRef(false);
  const isCheckingIn = useRef(false); // true while a request is in-flight
  const scanPaused = useRef(false);   // true after a result — blocks new scans until "Scan Next"

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("events")
        .select("id, title, date")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      setEvents(data || []);
      if (data?.length === 1) setSelectedEvent(data[0].id);
    })();
  }, []);

  const doCheckIn = useCallback(async (ticketId: string) => {
    if (!selectedEvent || isCheckingIn.current) return;

    // Lock immediately (synchronous) before any await
    isCheckingIn.current = true;
    scanPaused.current = true;
    setLoading(true);
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      isCheckingIn.current = false;
      setLoading(false);
      return;
    }

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
      const r: ScanResult = { valid: res.ok && data.valid, ...data };
      setResult(r);

      // Haptic feedback — works on most Android / iOS devices
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(r.valid ? [150] : [80, 60, 80]);
      }
    } catch {
      setResult({ valid: false, reason: "Network error — check connection and try again." });
    } finally {
      setLoading(false);
      isCheckingIn.current = false;
      // scanPaused stays true until "Scan Next" is pressed
    }
  }, [selectedEvent]);

  // Start / stop html5-qrcode camera
  useEffect(() => {
    if (mode !== "camera" || !selectedEvent || scannerStarted.current) return;

    let html5QrCode: any = null;
    scannerStarted.current = true;
    scanPaused.current = false;
    setScanning(false);
    setResult(null);

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            if (scanPaused.current || isCheckingIn.current) return;

            let ticketId = decodedText;
            try {
              const url = new URL(decodedText);
              ticketId = url.searchParams.get("t") || decodedText;
            } catch { /* raw UUID — use as-is */ }

            doCheckIn(ticketId);
          },
          () => { /* per-frame decode errors — suppress */ }
        )
        .then(() => setScanning(true))
        .catch(() => {
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

  const handleScanNext = () => {
    setResult(null);
    setManualId("");
    scanPaused.current = false;
  };

  const switchMode = (m: "camera" | "manual") => {
    setMode(m);
    setResult(null);
    scannerStarted.current = false;
    scanPaused.current = false;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) doCheckIn(manualId.trim());
  };

  const resultColor =
    result?.valid === true ? "#16a34a"
    : result?.reason?.includes("Already") ? "#d97706"
    : "#dc2626";

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-theme">Check-In Scanner</h1>
        <p className="text-theme-2 text-sm mt-0.5">Each QR can only be admitted once — re-scans are blocked.</p>
      </div>

      {/* Event selector */}
      <div>
        <label className="block text-sm font-medium text-theme-2 mb-1">Select Event</label>
        <select
          value={selectedEvent}
          onChange={e => {
            setSelectedEvent(e.target.value);
            setResult(null);
            scannerStarted.current = false;
            scanPaused.current = false;
          }}
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
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition"
                style={{
                  backgroundColor: mode === m ? "var(--brand-indigo)" : "var(--surface)",
                  color: mode === m ? "#fff" : "var(--text-secondary)",
                }}>
                {m === "camera" ? <Camera size={15} /> : <Keyboard size={15} />}
                {m === "camera" ? "Scan QR" : "Enter ID"}
              </button>
            ))}
          </div>

          {/* Camera view */}
          {mode === "camera" && (
            <div className="relative rounded-2xl overflow-hidden" style={{ border: "2px solid var(--border-color)" }}>
              <div id="qr-reader" className="w-full" />
              {!scanning && !result && (
                <div className="p-8 text-center flex flex-col items-center gap-3" style={{ color: "var(--text-muted)" }}>
                  <Camera className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Starting camera… allow access when prompted.</p>
                </div>
              )}
              {scanning && !result && !loading && (
                <div className="absolute bottom-0 left-0 right-0 py-3 text-center text-xs text-white font-medium"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", pointerEvents: "none" }}>
                  <ScanLine size={13} className="inline mr-1 mb-0.5" />
                  Point camera at the ticket QR code
                </div>
              )}
              {scanPaused.current && result && !loading && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center" style={{ pointerEvents: "none" }}>
                  <div className="text-white text-sm font-bold px-3 py-1.5 rounded-lg bg-black/50">
                    Scanner paused
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual entry */}
          {mode === "manual" && (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="Paste ticket UUID…"
                className="flex-1 p-3 rounded-xl text-sm font-mono"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
              />
              <button type="submit" disabled={loading || !manualId.trim()}
                className="px-5 py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Check In"}
              </button>
            </form>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
            </div>
          )}

          {/* Result card */}
          {result && !loading && (
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 text-white text-center" style={{ backgroundColor: resultColor }}>
                {result.valid
                  ? <CheckCircle2 className="h-14 w-14 mx-auto mb-3" />
                  : result.reason?.includes("Already")
                  ? <AlertCircle className="h-14 w-14 mx-auto mb-3" />
                  : <XCircle className="h-14 w-14 mx-auto mb-3" />}
                <h2 className="text-2xl font-bold">
                  {result.valid ? "Access Granted ✓"
                    : result.reason?.includes("Already") ? "Already Admitted ⚠️"
                    : "Access Denied ✗"}
                </h2>
                {result.reason && (
                  <p className="text-sm mt-1 opacity-80">{result.reason}</p>
                )}
                {result.reason?.includes("Already") && result.checkedInAt && (
                  <p className="text-xs mt-1 opacity-70">
                    First admitted at {new Date(result.checkedInAt).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div className="p-5 space-y-2.5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                {result.holder && <InfoRow label="Name" value={result.holder} />}
                {result.email && <InfoRow label="Email" value={result.email} />}
                {result.tier && <InfoRow label="Ticket Type" value={result.tier} />}
                {result.valid && result.checkedInAt && (
                  <InfoRow label="Admitted At" value={new Date(result.checkedInAt).toLocaleTimeString()} />
                )}

                {result.reason?.includes("Already") && (
                  <div className="flex items-start gap-2 p-3 rounded-xl mt-1"
                    style={{ backgroundColor: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}>
                    <ShieldAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      This ticket was already scanned. Do not admit this person — the QR code may be a duplicate or screenshot.
                    </p>
                  </div>
                )}

                <button onClick={handleScanNext}
                  className="mt-2 w-full py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
                  style={{ backgroundColor: "var(--brand-indigo)" }}>
                  Scan Next →
                </button>
              </div>
            </div>
          )}

          {/* Anti-fraud note */}
          {!result && !loading && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{ backgroundColor: "rgba(72,0,130,0.04)", border: "1px solid rgba(72,0,130,0.1)", color: "var(--text-muted)" }}>
              <ScanLine size={13} className="mt-0.5 shrink-0" style={{ color: "var(--brand-indigo)" }} />
              Each QR code is single-use. Once admitted, the ticket is marked "scanned" and any re-scan will be blocked.
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
