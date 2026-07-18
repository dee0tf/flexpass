"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Camera, Keyboard, ScanLine, ShieldAlert, WifiOff } from "lucide-react";

export interface CheckInEvent {
  id: string;
  title: string;
  date: string;
  organizer_name?: string | null;
}

type ScanResultCode =
  | "unrecognized" | "session_expired" | "event_not_found" | "not_your_event"
  | "not_found" | "wrong_event" | "already_checked_in" | "not_valid"
  | "server_error" | "offline";

interface ScanResult {
  valid: boolean | null;
  code?: ScanResultCode;
  reason?: string;
  holder?: string;
  email?: string;
  tier?: string;
  checkedInAt?: string;
  giveaway?: boolean;
}

// Shape of the JSON body returned by /api/checkin.
interface CheckInApiResponse {
  valid?: boolean;
  code?: ScanResultCode;
  reason?: string;
  error?: string;
  holder?: string;
  email?: string;
  tier?: string;
  checkedInAt?: string;
  giveaway?: boolean;
}

// Per-failure-reason presentation — keeps the result card specific
// ("unrecognized barcode", "already scanned") instead of a blanket denial.
const RESULT_PRESETS: Record<ScanResultCode, { title: string; color: string; icon: "warning" | "invalid" }> = {
  unrecognized:       { title: "Unrecognized Barcode",   color: "#dc2626", icon: "invalid" },
  not_found:          { title: "Ticket Doesn't Exist",   color: "#dc2626", icon: "invalid" },
  wrong_event:        { title: "Wrong Event",            color: "#dc2626", icon: "invalid" },
  not_valid:          { title: "Ticket Invalid",         color: "#dc2626", icon: "invalid" },
  already_checked_in: { title: "Already Admitted",       color: "#d97706", icon: "warning" },
  session_expired:    { title: "Scanner Signed Out",     color: "#dc2626", icon: "invalid" },
  not_your_event:     { title: "No Access To This Event",color: "#dc2626", icon: "invalid" },
  event_not_found:    { title: "Event Not Found",        color: "#dc2626", icon: "invalid" },
  server_error:       { title: "Connection Problem",     color: "#dc2626", icon: "invalid" },
  offline:            { title: "You're Offline",         color: "#dc2626", icon: "invalid" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractTicketId(raw: string): string {
  const trimmed = raw.trim().replace(/^#+/, "");
  // If it's already a plain UUID, return it directly
  if (UUID_RE.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    // QR code format: /checkin/verify?t=UUID
    const t = url.searchParams.get("t");
    if (t && UUID_RE.test(t)) return t;
    // Ticket page URL format: /tickets/UUID
    const segments = url.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      if (UUID_RE.test(segments[i])) return segments[i];
    }
  } catch {
    // not a URL, return as-is
  }
  return trimmed;
}

/**
 * Shared scanning UI/logic for both the host's own check-in page
 * (/dashboard/checkin) and the admin check-in page (/admin/checkin) — the
 * only difference between the two is which events the caller passes in and
 * which account is authenticating; /api/checkin authorizes either the
 * event's owner or an admin.
 */
export default function CheckInScanner({
  events,
  title = "Check-In Scanner",
  subtitle = "Each QR can only be admitted once — re-scans are blocked.",
}: {
  events: CheckInEvent[];
  title?: string;
  subtitle?: string;
}) {
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualId, setManualId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const scannerRef = useRef<any>(null);
  const scannerStarted = useRef(false);
  const isCheckingIn = useRef(false);
  const scanPaused = useRef(false);

  useEffect(() => {
    if (events.length === 1) setSelectedEvent(events[0].id);
  }, [events]);

  // Online/offline detection
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  // POST /api/checkin and normalize the response into a ScanResult.
  // Returns null on a network-level failure (caller decides the message).
  const postCheckIn = useCallback(async (ticketId: string, token: string): Promise<{ res: Response; data: CheckInApiResponse } | null> => {
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId, eventId: selectedEvent }),
      });
      const data = await res.json();
      return { res, data };
    } catch {
      return null;
    }
  }, [selectedEvent]);

  const doCheckIn = useCallback(async (rawId: string) => {
    if (!selectedEvent || isCheckingIn.current) return;

    const ticketId = extractTicketId(rawId);
    if (!ticketId) return;

    isCheckingIn.current = true;
    scanPaused.current = true;
    setLoading(true);
    setResult(null);

    if (!isOnline) {
      setResult({
        valid: false,
        code: "offline",
        reason: "You're offline — re-scan detection requires an internet connection. Do not admit this ticket until you reconnect.",
      });
      setLoading(false);
      isCheckingIn.current = false;
      return;
    }

    let session: any = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    } catch {
      // getSession failure — treat as logged out
    }
    if (!session) {
      setResult({ valid: false, code: "session_expired", reason: "You're signed out — sign in again to keep scanning." });
      setLoading(false);
      isCheckingIn.current = false;
      return;
    }

    let outcome = await postCheckIn(ticketId, session.access_token);

    // A stale access token (e.g. the tab sat backgrounded past its expiry)
    // surfaces as a 401 here — refresh once and retry before telling the
    // door staff the ticket itself is the problem.
    if (outcome && outcome.data.code === "session_expired") {
      const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
      if (refreshed?.session) {
        outcome = await postCheckIn(ticketId, refreshed.session.access_token);
      }
    }

    if (!outcome) {
      setResult({ valid: false, code: "server_error", reason: "Couldn't reach the server — check connection and try again." });
      setLoading(false);
      isCheckingIn.current = false;
      return;
    }

    const { res, data } = outcome;
    const r: ScanResult = {
      valid: res.ok && !!data.valid,
      code: data.code,
      // Map either `reason` or `error` field so the UI always has a message
      reason: data.reason || data.error,
      holder: data.holder,
      email: data.email,
      tier: data.tier,
      checkedInAt: data.checkedInAt,
      giveaway: data.giveaway,
    };
    setResult(r);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(r.valid ? [150] : [80, 60, 80]);
    }
    setLoading(false);
    isCheckingIn.current = false;
  }, [selectedEvent, isOnline, postCheckIn]);

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
          // Ideal width/height nudges iOS/Android away from picking a low-res
          // or ultra-wide-lens stream — both make small QR detail too blurry
          // or too tiny in-frame for the decoder to lock on.
          { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          {
            fps: 10,
            // Scan box sized relative to the actual video feed rather than a
            // fixed 260px square, so it stays well-framed on any screen size.
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
              return { width: size, height: size };
            },
          },
          (decodedText: string) => {
            if (scanPaused.current || isCheckingIn.current) return;
            doCheckIn(decodedText);
          },
          () => {}
        )
        .then(() => setScanning(true))
        .catch(() => {
          setScanning(false);
          scannerStarted.current = false;
        });
    });

    return () => {
      if (html5QrCode) {
        try {
          html5QrCode.stop()
            .catch(() => {})
            .finally(() => {
              scannerStarted.current = false;
              setScanning(false);
            });
        } catch {
          // stop() throws synchronously when scanner never fully started
          // (e.g. camera permission denied) — reset state manually
          scannerStarted.current = false;
          setScanning(false);
        }
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
    if (manualId.trim()) doCheckIn(manualId.trim()).catch(() => {
      setResult({ valid: false, reason: "Unexpected error — please try again." });
      setLoading(false);
      isCheckingIn.current = false;
    });
  };

  const resultPreset = result?.code ? RESULT_PRESETS[result.code] : undefined;
  const resultColor = result?.valid === true ? "#16a34a" : (resultPreset?.color ?? "#dc2626");
  const isDuplicate = result?.code === "already_checked_in";

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-theme">{title}</h1>
        <p className="text-theme-2 text-sm mt-0.5">{subtitle}</p>
      </div>

      {/* Offline warning banner */}
      {!isOnline && (
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "2px solid rgba(239,68,68,0.3)" }}>
          <WifiOff className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-bold text-red-600 text-sm">You are offline</p>
            <p className="text-red-500 text-xs mt-0.5">Do not admit anyone until you reconnect. Re-scan detection requires internet to verify tickets against the database.</p>
          </div>
        </div>
      )}

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
              {ev.organizer_name ? ` (${ev.organizer_name})` : ""}
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
            </div>
          )}

          {/* Manual entry */}
          {mode === "manual" && (
            <div className="space-y-2">
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  placeholder="Paste ticket ID, reference code, or ticket URL…"
                  className="flex-1 p-3 rounded-xl text-sm font-mono"
                  style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
                />
                <button type="submit" disabled={loading || !manualId.trim()}
                  className="px-5 py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-indigo)" }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Check In"}
                </button>
              </form>
              <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
                Type the short reference code printed under the QR (e.g. <span className="font-mono">#xxxxxxxx-xxxx-xxxx</span>), the full ticket UUID, or the ticket page URL.
              </p>
            </div>
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
                  : resultPreset?.icon === "warning"
                  ? <AlertCircle className="h-14 w-14 mx-auto mb-3" />
                  : <XCircle className="h-14 w-14 mx-auto mb-3" />}
                <h2 className="text-2xl font-bold">
                  {result.valid ? "Access Granted ✓"
                    : resultPreset ? `${resultPreset.title}${resultPreset.icon === "warning" ? " ⚠️" : " ✗"}`
                    : "Access Denied ✗"}
                </h2>
                {result.reason && (
                  <p className="text-sm mt-1 opacity-90">{result.reason}</p>
                )}
                {isDuplicate && result.checkedInAt && (
                  <p className="text-xs mt-1 opacity-70">
                    First admitted at {new Date(result.checkedInAt).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div className="p-5 space-y-2.5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                {result.giveaway && (
                  <div className="flex justify-center">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "rgba(255,183,0,0.15)", color: "#d97706" }}>
                      🎁 Giveaway
                    </span>
                  </div>
                )}
                {result.holder && <InfoRow label="Name" value={result.holder} />}
                {result.email && <InfoRow label="Email" value={result.email} />}
                {result.tier && <InfoRow label="Ticket Type" value={result.tier} />}
                {result.valid && result.checkedInAt && (
                  <InfoRow label="Admitted At" value={new Date(result.checkedInAt).toLocaleTimeString()} />
                )}

                {isDuplicate && (
                  <div className="flex items-start gap-2 p-3 rounded-xl mt-1"
                    style={{ backgroundColor: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}>
                    <ShieldAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      This ticket was already scanned. Do not admit — the QR code may be a duplicate or screenshot.
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
