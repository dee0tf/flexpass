"use client";

import { useState } from "react";
import dynamic from "next/dynamic"; // <--- 1. Import Dynamic tool
import { TicketTier } from "@/components/CheckoutModal";

// 2. Import the Modal dynamically and turn off SSR (Server Side Rendering)
const CheckoutModal = dynamic(
  () => import("@/components/CheckoutModal"),
  { ssr: false }
);

interface ClientProps {
  eventTitle: string;
  eventPrice: number;
  eventId: string;
  tiers: TicketTier[];
}

export default function ClientEventPage({ eventTitle, eventPrice, eventId, tiers }: ClientProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Formatting price logic
  // If we have multiple tiers, show "From lowestPrice"
  // If we have 1 tier or 0, existing logic holds (eventPrice is presumably the min price from the DB)

  const hasMultipleTiers = tiers && tiers.length > 1;
  const lowestPrice = tiers && tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : eventPrice;

  const priceDisplay = hasMultipleTiers
    ? `From ₦${lowestPrice.toLocaleString()}`
    : `₦${lowestPrice.toLocaleString()}`;

  return (
    <>
      {/* Sticky Bottom Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg flex items-center justify-between md:hidden z-50">
        <div>
          <p className="text-sm text-slate-500">Price</p>
          <p className="text-xl font-bold text-[#581c87]">
            {priceDisplay}
          </p>
        </div>
        <button
          onClick={() => setIsCheckoutOpen(true)}
          className="bg-gradient-to-b from-[#f97316] to-[#581c87] text-white px-8 py-3 rounded-xl font-bold shadow-md"
        >
          Buy Ticket
        </button>
      </div>

      {/* Floating Card for Desktop */}
      <div className="hidden md:block fixed bottom-10 right-10 bg-white p-6 rounded-2xl shadow-2xl border border-slate-100 z-50 w-80">
        <p className="text-slate-500 mb-1">{hasMultipleTiers ? "Starting from" : "Price per ticket"}</p>
        <p className="text-3xl font-bold text-[#581c87] mb-6">
          {priceDisplay}
        </p>
        <button
          onClick={() => setIsCheckoutOpen(true)}
          className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold shadow-md hover:opacity-90"
        >
          Get Tickets
        </button>
      </div>

      {/* The Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          open={isCheckoutOpen}
          onOpenChange={setIsCheckoutOpen}
          eventTitle={eventTitle}
          eventId={eventId}
          tiers={tiers}
          price={eventPrice}
        />
      )}
    </>
  );
}