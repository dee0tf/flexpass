"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface TicketInfo {
  found: boolean;
  status: string;
  holder: string;
  tier: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  event: { title: string; date: string; location: string } | null;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("t");
  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) { setLoading(false); return; }
    fetch(`/api/checkin?t=${ticketId}`)
      .then(r => r.json())
      .then(data => { setInfo(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ticketId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  if (!ticketId || !info?.found) {
    return <Result icon="invalid" title="Invalid Ticket" subtitle="This QR code is not recognised." />;
  }

  if (info.status !== "valid") {
    return <Result icon="invalid" title="Ticket Cancelled" subtitle={`Status: ${info.status}`} />;
  }

  if (info.checkedIn) {
    return (
      <Result
        icon="warning"
        title="Already Checked In"
        subtitle={`This ticket was already used at ${info.checkedInAt ? new Date(info.checkedInAt).toLocaleTimeString() : "an earlier time"}.`}
        holder={info.holder}
        tier={info.tier}
        event={info.event}
      />
    );
  }

  return (
    <Result
      icon="valid"
      title="Valid Ticket"
      subtitle="Present this screen to the staff to complete check-in."
      holder={info.holder}
      tier={info.tier}
      event={info.event}
    />
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

function Result({
  icon, title, subtitle, holder, tier, event,
}: {
  icon: "valid" | "invalid" | "warning";
  title: string;
  subtitle: string;
  holder?: string;
  tier?: string;
  event?: { title: string; date: string; location: string } | null;
}) {
  const colours = {
    valid:   "#16a34a",
    invalid: "#dc2626",
    warning: "#d97706",
  }[icon];

  const Icon = icon === "valid" ? CheckCircle2 : icon === "warning" ? AlertCircle : XCircle;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-sm w-full rounded-3xl overflow-hidden shadow-xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-color)" }}>
        <div className="p-8 flex flex-col items-center text-white" style={{ backgroundColor: colours }}>
          <Icon className="h-16 w-16 mb-3" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm mt-1 opacity-80 text-center">{subtitle}</p>
        </div>

        {(holder || event) && (
          <div className="p-6 space-y-4">
            {holder && <Row label="Ticket Holder" value={holder} />}
            {tier && <Row label="Ticket Type" value={tier} />}
            {event && (
              <>
                <Row label="Event" value={event.title} />
                <Row label="Date" value={new Date(event.date).toDateString()} />
                <Row label="Venue" value={event.location} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm font-medium shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
