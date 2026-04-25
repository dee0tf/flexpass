"use client";

import React, { useState, useEffect } from "react";
import { Plus, Minus, Loader2, Check } from "lucide-react";
import { PaystackButton } from "react-paystack";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAYSTACK_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  remaining?: number; // tickets left for this tier
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventId: string;
  price: number;
  tiers?: TicketTier[];
  legacyRemaining?: number;
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
  price: basePrice,
  tiers = [],
  legacyRemaining,
}: CheckoutModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [subaccountCode, setSubaccountCode] = useState<string | null>(null);

  // Fetch host's subaccount code for automatic fund splitting
  useEffect(() => {
    fetch(`/api/event-subaccount?eventId=${eventId}`)
      .then(r => r.json())
      .then(d => setSubaccountCode(d.subaccount_code || null))
      .catch(() => {});
  }, [eventId]);

  // Email validation helper
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (emailError) setEmailError(""); // Clear error on type
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError("Please enter a valid email address");
    }
  };

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

  // Free ticket detection — fee on a ₦0 ticket is also ₦0
  const isFree = totalAmount === 0 && (isLegacyEvent || !!selectedTier);

  // Free ticket claim — bypasses Paystack entirely, server verifies price from DB
  const handleClaimFree = async () => {
    if (!email || !fullName) { alert("Please enter your name and email."); return; }
    if (!isLegacyEvent && !selectedTier) { alert("Please select a ticket type."); return; }

    setIsSaving(true);
    try {
      const res = await fetch('/api/claim-free-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          email,
          fullName,
          quantity,
          tierId: selectedTier?.id || null,
          tierName: selectedTier?.name || (isLegacyEvent ? 'Standard' : null),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to claim ticket');

      // Send confirmation email in background
      fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventTitle, ticketId: result.ticketId, amount: 0 }),
      });

      onOpenChange(false);
      setQuantity(1);
      setEmail('');
      setFullName('');
      setSelectedTier(null);
      router.push(`/tickets/${result.ticketId}`);
    } catch (err: any) {
      alert('Could not claim ticket: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. The Success Logic — payment is verified SERVER-SIDE before ticket is created
  const handleSuccess = async (reference: PaystackSuccessResponse) => {
    if (!isLegacyEvent && !selectedTier) {
      alert("Please select a ticket type.");
      return;
    }

    setIsSaving(true);
    try {
      // Call our secure API route which verifies the payment with Paystack
      // before inserting any ticket into the database
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.reference,
          eventId,
          email,
          fullName,
          quantity,
          tierId: selectedTier?.id || null,
          tierName: selectedTier?.name || (isLegacyEvent ? "Standard" : null),
          price: finalPrice,
          fee,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Payment verification failed');
      }

      const newTicketId = result.ticketId;

      // Send email receipt in the background
      fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, eventTitle, ticketId: newTicketId, amount: totalAmount }),
      });

      onOpenChange(false);
      setQuantity(1);
      setEmail("");
      setFullName("");
      setSelectedTier(null);

      router.push(`/tickets/${newTicketId}`);

    } catch (error: any) {
      alert("Ticket processing failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => { /* modal closed */ };

  // 3. Configuration for the Button Component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const componentProps: any = {
    email,
    amount: totalAmount * 100, // Kobo
    publicKey: PAYSTACK_KEY || "",
    text: `Pay ₦${totalAmount.toLocaleString()}`,
    onSuccess: (ref: any) => handleSuccess(ref),
    onClose: handleClose,
    // Automatic split — host gets 95%, FlexPass keeps 5%
    // Only applied when the host has a verified Paystack subaccount
    ...(subaccountCode ? { subaccount: subaccountCode, bearer: "subaccount" } : {}),
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
                {tiers.map((tier) => {
                  const soldOut = tier.remaining !== undefined && tier.remaining <= 0;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => !soldOut && setSelectedTier(tier)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        soldOut
                          ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                          : selectedTier?.id === tier.id
                          ? "ring-1 cursor-pointer"
                          : "border-slate-200 hover:border-purple-200 hover:bg-slate-50 cursor-pointer"
                      }`}
                      style={selectedTier?.id === tier.id && !soldOut ? {
                        borderColor: "var(--brand-indigo)",
                        backgroundColor: "rgba(72,0,130,0.05)",
                        boxShadow: `0 0 0 1px var(--brand-indigo)`,
                      } : {}}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{tier.name}</p>
                        <p className="text-sm text-slate-500">₦{tier.price.toLocaleString()}</p>
                        {soldOut ? (
                          <p className="text-xs font-semibold text-red-500 mt-0.5">Sold out</p>
                        ) : tier.remaining !== undefined && tier.remaining <= 20 ? (
                          <p className="text-xs font-semibold text-orange-500 mt-0.5">{tier.remaining} left</p>
                        ) : null}
                      </div>
                      {selectedTier?.id === tier.id && !soldOut && (
                        <div className="text-white p-1 rounded-full" style={{ backgroundColor: "var(--brand-indigo)" }}>
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      {soldOut && (
                        <span className="text-xs font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Sold Out</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUANTITY & SUMMARY - Show if: (Legacy Event) OR (Tier Selected) */}
          {(isLegacyEvent || selectedTier) && (
            <>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-raised)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-semibold" style={{ color: "var(--text-primary)" }}>
                      {selectedTier ? `${selectedTier.name} Ticket` : "Standard Ticket"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      ₦{finalPrice.toLocaleString()} each
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="h-11 w-11 rounded-full"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-xl font-bold w-6 text-center" style={{ color: "var(--text-primary)" }}>{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(
                        isLegacyEvent
                          ? Math.min(10, legacyRemaining ?? 10)
                          : Math.min(10, selectedTier?.remaining ?? 10),
                        quantity + 1
                      ))}
                      disabled={
                        isLegacyEvent
                          ? quantity >= (legacyRemaining ?? 10)
                          : quantity >= (selectedTier?.remaining ?? 10)
                      }
                      className="h-11 w-11 rounded-full"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* Tickets remaining count */}
                {(() => {
                  const rem = isLegacyEvent ? legacyRemaining : selectedTier?.remaining;
                  if (rem === undefined) return null;
                  if (rem <= 0) return (
                    <p className="text-xs font-semibold text-red-500 mt-2">This ticket type is sold out.</p>
                  );
                  if (rem <= 20) return (
                    <p className="text-xs font-semibold text-orange-500 mt-2">Only {rem} ticket{rem !== 1 ? "s" : ""} remaining!</p>
                  );
                  return (
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{rem} tickets available</p>
                  );
                })()}
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
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`rounded-xl h-12 ${emailError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-1 animate-pulse">{emailError}</p>
                )}
              </div>

              <div className="pt-2">
                <div className="space-y-2 mb-4">
                  {isFree ? (
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>Total</span>
                      <span className="text-2xl font-bold text-green-600">Free</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span>₦{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span>Service Fee (5%)</span>
                        <span>₦{fee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <span className="font-bold" style={{ color: "var(--text-primary)" }}>Total</span>
                        <span className="text-2xl font-bold" style={{ color: "var(--brand-indigo)" }}>
                          ₦{totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {isSaving ? (
                  <button
                    disabled
                    className="w-full text-white py-4 rounded-xl font-bold text-lg opacity-70 flex items-center justify-center gap-2"
                    style={{ backgroundColor: "var(--brand-indigo)" }}
                  >
                    <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                  </button>
                ) : isFree ? (
                  // Free ticket — no Paystack, server verifies price=0 from DB
                  <button
                    onClick={handleClaimFree}
                    disabled={!email || !fullName || !!emailError}
                    className="w-full text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "var(--brand-indigo)" }}
                  >
                    Claim Free Ticket
                  </button>
                ) : (
                  // Paid ticket — Paystack handles payment
                  <div className="w-full relative rounded-xl overflow-hidden" style={{ backgroundColor: "var(--brand-indigo)" }}>
                    {(!email || !fullName || emailError) && (
                      <div
                        className="absolute inset-0 z-10 cursor-not-allowed"
                        onClick={() => {
                          if (!email || !fullName) alert("Please enter your name and email");
                          else if (emailError) alert("Please fix the email error");
                        }}
                      />
                    )}
                    <PaystackButton
                      {...componentProps}
                      className={`w-full py-4 font-bold text-lg text-white hover:opacity-90 transition-opacity bg-transparent ${(!email || !fullName || emailError) ? "opacity-50 pointer-events-none" : ""}`}
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