"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TicketTier } from "@/components/CheckoutModal";

const CheckoutModal = dynamic(
  () => import("@/components/CheckoutModal"),
  { ssr: false }
);

interface ClientProps {
  eventTitle: string;
  eventPrice: number;
  eventId: string;
  tiers: TicketTier[];
  legacyRemaining: number;
}

export default function ClientEventPage({ eventTitle, eventPrice, eventId, tiers, legacyRemaining }: ClientProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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

  return (
    <>
      {/* Sticky Bottom Bar — Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 shadow-lg flex items-center justify-between md:hidden z-50"
        style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border-color)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Price</p>
          <p className="text-xl font-bold" style={{ color: "var(--brand-indigo)" }}>{priceDisplay}</p>
          {totalRemaining <= 20 && !soldOut && (
            <p className="text-xs font-semibold text-orange-500">{totalRemaining} left!</p>
          )}
        </div>
        <button
          onClick={() => setIsCheckoutOpen(true)}
          disabled={soldOut}
          className="px-8 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: soldOut ? "var(--text-muted)" : "var(--brand-indigo)" }}
        >
          {soldOut ? "Sold Out" : "Buy Ticket"}
        </button>
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
        {totalRemaining <= 20 && !soldOut && (
          <p className="text-sm font-semibold text-orange-500 mb-4">Only {totalRemaining} tickets left!</p>
        )}
        {!totalRemaining || soldOut ? null : <div className="mb-4" />}
        <button
          onClick={() => setIsCheckoutOpen(true)}
          disabled={soldOut}
          className="w-full py-4 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: soldOut ? "var(--text-muted)" : "var(--brand-indigo)" }}
        >
          {soldOut ? "Sold Out" : "Get Tickets"}
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
