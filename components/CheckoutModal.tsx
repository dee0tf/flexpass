"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, Loader2, Check } from "lucide-react";
import { PaystackButton } from "react-paystack";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAYSTACK_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

export interface TicketTier {
  id: string;
  name: string;
  price: number;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventId: string;
  price: number; // Restored for legacy events/fallback
  tiers?: TicketTier[];
}

// Define the shape of the Paystack response
interface PaystackSuccessResponse {
  reference: string;
  message: string;
  status: string;
  trans: string;
  transaction: string;
  trxref: string;
}

export default function CheckoutModal({
  open,
  onOpenChange,
  eventTitle,
  eventId,
  price: basePrice, // Rename to basePrice
  tiers = [],
}: CheckoutModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);

  // Determine if we are in "Legacy Mode" (No tiers)
  const isLegacyEvent = tiers.length === 0;

  // Auto-select logic
  useEffect(() => {
    if (tiers.length === 1) {
      setSelectedTier(tiers[0]);
    }
  }, [tiers]);

  // --- INITIALIZE ROUTER ---
  const router = useRouter();

  // PRICE LOGIC
  // If legacy, use basePrice. If tiers, use selectedTier price (or 0 if none selected)
  const finalPrice = isLegacyEvent ? basePrice : (selectedTier ? selectedTier.price : 0);

  // FEE LOGIC
  const FEE_PERCENTAGE = 0.05; // 5%
  const subtotal = finalPrice * quantity;
  const fee = subtotal * FEE_PERCENTAGE;
  const totalAmount = subtotal + fee;

  // 2. The Success Logic
  const handleSuccess = async (reference: PaystackSuccessResponse) => {
    if (!isLegacyEvent && !selectedTier) {
      alert("Please select a ticket type.");
      return;
    }

    console.log("✅ COMPONENT SUCCESS! Processing Order...", {
      eventId: eventId,
      ref: reference.reference
    });

    setIsSaving(true);
    try {
      const ticketsToCreate = Array.from({ length: quantity }).map(() => ({
        event_id: eventId,
        user_email: email,
        user_name: fullName,
        status: "valid",
        purchase_reference: reference.reference,
        fee_amount: fee / quantity,
        total_amount_paid: (finalPrice + (fee / quantity)),
        tier_id: selectedTier?.id || null,     // Null for legacy
        tier_name: selectedTier?.name || (isLegacyEvent ? "Standard" : null) // 'Standard' for legacy
      }));

      // --- 1. Save to Database ---
      const { data, error } = await supabase
        .from("tickets")
        .insert(ticketsToCreate)
        .select();

      if (error) throw error;

      const newTicketId = data[0].id; // Get ID of the first ticket

      // --- 2. NEW: Send Email Receipt (Background Task) ---
      fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          eventTitle: eventTitle,
          ticketId: newTicketId,
          amount: totalAmount
        })
      });
      console.log("📧 Email request sent!");

      // --- 3. Redirect Logic ---
      console.log("🎟️ Ticket Created! Redirecting to:", newTicketId);

      onOpenChange(false); // Close modal
      setQuantity(1);
      setEmail("");
      setFullName("");
      setSelectedTier(null);

      // Redirect to the new Ticket Page
      router.push(`/tickets/${newTicketId}`);

    } catch (error: any) {
      console.error("Database Error:", error);
      alert("Payment received, but ticket save failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    console.log("Payment closed");
  };

  // 3. Configuration for the Button Component
  const componentProps = {
    email: email,
    amount: totalAmount * 100, // Kobo
    publicKey: PAYSTACK_KEY || "",
    text: `Pay ₦${totalAmount.toLocaleString()}`,
    onSuccess: (ref: any) => handleSuccess(ref),
    onClose: handleClose,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {eventTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">

          {/* TIER SELECTION - Only show if > 1 tier */}
          {tiers.length > 1 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-600">Select Ticket Type</label>
              <div className="grid gap-3">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedTier?.id === tier.id
                        ? "border-[#581c87] bg-purple-50 ring-1 ring-[#581c87]"
                        : "border-slate-200 hover:border-purple-200 hover:bg-slate-50"
                      }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{tier.name}</p>
                      <p className="text-sm text-slate-500">₦{tier.price.toLocaleString()}</p>
                    </div>
                    {selectedTier?.id === tier.id && (
                      <div className="bg-[#581c87] text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUANTITY & SUMMARY - Show if: (Legacy Event) OR (Tier Selected) */}
          {(isLegacyEvent || selectedTier) && (
            <>
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="block text-slate-900 font-semibold">
                    {selectedTier ? `${selectedTier.name} Ticket` : "Standard Ticket"}
                  </span>
                  <span className="text-xs text-slate-500">
                    ₦{finalPrice.toLocaleString()} each
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-8 w-8 rounded-full"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold w-4 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                    className="h-8 w-8 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl h-12"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">
                  Where should we send your ticket?
                </label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-12"
                />
              </div>

              <div className="pt-2">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Service Fee (5%)</span>
                    <span>₦{fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-[#581c87]">
                      ₦{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {isSaving ? (
                  <button
                    disabled
                    className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold text-lg opacity-70 flex items-center justify-center gap-2"
                  >
                    <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                  </button>
                ) : (
                  <div className="w-full relative">
                    {/* Block click if no email or name */}
                    {(!email || !fullName) && <div className="absolute inset-0 z-10" onClick={() => alert("Please enter your name and email")} />}

                    <PaystackButton
                      {...componentProps}
                      className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-indigo-200"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {!isLegacyEvent && !selectedTier && tiers.length > 0 && (
            <p className="text-center text-slate-500 text-sm">Please select a ticket type to continue.</p>
          )}

          {/* This state should technically not happen if handled correctly upstream, but as fallback */}
          {!isLegacyEvent && tiers.length === 0 && (
            <p className="text-center text-red-500 font-medium">No tickets available for this event.</p>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}