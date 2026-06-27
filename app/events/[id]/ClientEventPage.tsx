"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Share2, Check, Clock } from "lucide-react";
import type { TicketTier } from "@/components/CheckoutModal";

const CheckoutModal = dynamic(
  () => import("@/components/CheckoutModal"),
  { ssr: false }
);

interface ClientProps {
  eventTitle: string;
  eventPrice: number;
  eventId: string;
  eventDate: string;
  tiers: TicketTier[];
  legacyRemaining: number;
}

export default function ClientEventPage({ eventTitle, eventPrice, eventId, eventDate, tiers, legacyRemaining }: ClientProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Capture promoter ref code from URL and persist for checkout
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) sessionStorage.setItem(`ref_${eventId}`, ref);
  }, [eventId]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try { await navigator.share({ title: eventTitle, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const hasMultipleTiers = tiers && tiers.length > 1;
  const lowestPrice = tiers && tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : eventPrice;

  const priceDisplay = hasMultipleTiers
    ? `From ₦${lowestPrice.toLocaleString()}`
    : `₦${lowestPrice.toLocaleString()}`;

  // Total remaining across all tiers (or legacy)
  const totalRemaining = tiers.length > 0
    ? tiers.reduce((acc, t) => acc + (t.remaining ?? 0), 0)
    : legacyRemaining;

  const soldOut = totalRemaining === 0;
  // Date-only strings are parsed as UTC midnight; append end-of-day to keep the event active all day locally
  const endedDate = eventDate.includes("T") ? new Date(eventDate) : new Date(eventDate + "T23:59:59");
  const ended = endedDate < new Date();

  // Nearest active early bird tier
  const now = Date.now();
  const earlyBirdTier = tiers
    .filter(t => t.ends_at && new Date(t.ends_at).getTime() > now)
    .sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime())[0] ?? null;

  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!earlyBirdTier?.ends_at) { setCountdown(null); return; }
    const target = new Date(earlyBirdTier.ends_at).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown(null); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      const parts = h > 0
        ? `${h}h ${m}m ${s}s`
        : m > 0 ? `${m}m ${s}s` : `${s}s`;
      setCountdown(parts);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [earlyBirdTier?.ends_at]);

  return (
    <>
      {/* Sticky Bottom Bar — Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 shadow-lg flex items-center justify-between md:hidden z-50"
        style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border-color)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Price</p>
          <p className="text-xl font-bold" style={{ color: "var(--brand-indigo)" }}>{priceDisplay}</p>
          {countdown && (
            <p className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--brand-gold)" }}>
              <Clock className="h-3 w-3" /> Early bird ends in {countdown}
            </p>
          )}
          {!countdown && totalRemaining <= 20 && !soldOut && (
            <p className="text-xs font-semibold text-orange-500">{totalRemaining} left!</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-3 rounded-xl border transition hover:opacity-80"
            style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--border-color)" }}
            aria-label="Share event"
          >
            {shareCopied ? <Check className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5" style={{ color: "var(--brand-indigo)" }} />}
          </button>
          <button
            onClick={() => setIsCheckoutOpen(true)}
            disabled={soldOut || ended}
            className="px-8 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: ended ? "#6b7280" : soldOut ? "var(--text-muted)" : "var(--brand-indigo)" }}
          >
            {ended ? "Ended" : soldOut ? "Sold Out" : "Buy Ticket"}
          </button>
        </div>
      </div>

      {/* Floating Card — Desktop */}
      <div className="hidden md:block fixed bottom-10 right-10 p-6 rounded-2xl shadow-2xl z-50 w-80"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-color)" }}
      >
        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
          {hasMultipleTiers ? "Starting from" : "Price per ticket"}
        </p>
        <p className="text-3xl font-bold mb-1" style={{ color: "var(--brand-indigo)" }}>
          {priceDisplay}
        </p>
        {countdown && (
          <p className="text-sm font-semibold flex items-center gap-1 mb-3" style={{ color: "var(--brand-gold)" }}>
            <Clock className="h-4 w-4" /> Early bird ends in {countdown}
          </p>
        )}
        {!countdown && totalRemaining <= 20 && !soldOut && (
          <p className="text-sm font-semibold text-orange-500 mb-4">Only {totalRemaining} tickets left!</p>
        )}
        {!totalRemaining || soldOut ? null : <div className="mb-4" />}
        <button
          onClick={() => setIsCheckoutOpen(true)}
          disabled={soldOut || ended}
          className="w-full py-4 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: ended ? "#6b7280" : soldOut ? "var(--text-muted)" : "var(--brand-indigo)" }}
        >
          {ended ? "Event Ended" : soldOut ? "Sold Out" : "Get Tickets"}
        </button>
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-xl font-bold text-sm transition hover:opacity-80 flex items-center justify-center gap-2 mt-2"
          style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
        >
          {shareCopied ? <><Check className="h-4 w-4 text-green-500" /> Link Copied!</> : <><Share2 className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} /> Share Event</>}
        </button>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal
          open={isCheckoutOpen}
          onOpenChange={setIsCheckoutOpen}
          eventTitle={eventTitle}
          eventId={eventId}
          tiers={tiers}
          price={eventPrice}
          legacyRemaining={legacyRemaining}
        />
      )}
    </>
  );
}
