"use client";

import { useState } from "react";
import CheckoutModal from "@/components/CheckoutModal";

interface CheckoutSectionProps {
  price: number;
  eventId: string;
  eventTitle: string;
}

export default function CheckoutSection({
  price,
  eventId,
  eventTitle,
}: CheckoutSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-white border-t border-gray-200 shadow-lg p-4 lg:border-t-0 lg:rounded-2xl lg:shadow-sm lg:p-6 lg:sticky lg:top-8">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Price</p>
          <p className="text-3xl font-bold text-flex-purple">
            ₦{price.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          Buy Ticket
        </button>
      </div>

      <CheckoutModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        eventTitle={eventTitle}
        price={price}
        eventId={eventId}
      />
    </>
  );
}

