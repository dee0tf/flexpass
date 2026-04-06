"use client";

import { CalendarPlus, Share2, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  eventId: string;
}

function buildGoogleCalendarUrl(title: string, date: string, location: string) {
  const start = new Date(date);
  // Default 3-hour event window
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location,
    details: `Ticket purchased via FlexPass. See you there!`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function TicketActions({ eventTitle, eventDate, eventLocation, eventId }: Props) {
  const [copied, setCopied] = useState(false);

  const eventUrl = typeof window !== "undefined"
    ? `${window.location.origin}/events/${eventId}`
    : `/events/${eventId}`;

  const handleShare = async () => {
    const shareData = {
      title: eventTitle,
      text: `I just got my ticket for ${eventTitle} on FlexPass!`,
      url: eventUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled — no-op
      }
    } else {
      // Fallback: copy link
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const calUrl = buildGoogleCalendarUrl(eventTitle, eventDate, eventLocation);

  return (
    <div className="flex gap-3">
      <a
        href={calUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition hover:opacity-90"
        style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
      >
        <CalendarPlus className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
        Add to Calendar
      </a>

      <button
        onClick={handleShare}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition hover:opacity-90"
        style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
      >
        {copied
          ? <><Check className="h-4 w-4 text-green-500" /> Copied!</>
          : <><Share2 className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} /> Share Event</>
        }
      </button>
    </div>
  );
}
