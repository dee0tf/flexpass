"use client";

import React, { useState, useEffect } from "react";
import { Plus, Minus, Loader2, Check, X } from "lucide-react";
import { PaystackButton } from "react-paystack";
import { useRouter } from "next/navigation";

const PAYSTACK_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  remaining?: number;
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

interface PaystackSuccessResponse {
  reference: string;
  message: string;
  status: string;
  trans: string;
  transaction: string;
  trxref: string;
}

// Shared input style — always adapts to dark/light via CSS vars
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text-primary)",
};
const labelStyle: React.CSSProperties = { color: "var(--text-secondary)" };

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
  const [gender, setGender] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [paystackActive, setPaystackActive] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TicketTier | null>(null);
  const [subaccountCode, setSubaccountCode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/event-subaccount?eventId=${eventId}`)
      .then(r => r.json())
      .then(d => setSubaccountCode(d.subaccount_code || null))
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    if (tiers.length === 1) setSelectedTier(tiers[0]);
  }, [tiers]);

  // Lock/unlock body scroll with modal open state
  useEffect(() => {
    if (open && !paystackActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, paystackActive]);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.toLowerCase());

  const isLegacyEvent = tiers.length === 0;
  const finalPrice = isLegacyEvent ? basePrice : (selectedTier ? selectedTier.price : 0);
  const FEE_PERCENTAGE = 0.05;
  const subtotal = finalPrice * quantity;
  const fee = Math.round(subtotal * FEE_PERCENTAGE * 100) / 100;
  const totalAmount = subtotal + fee;
  const isFree = totalAmount === 0 && (isLegacyEvent || !!selectedTier);

  const resetForm = () => {
    setQuantity(1); setEmail(""); setFullName(""); setGender(""); setSelectedTier(null);
  };

  const handleClaimFree = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/claim-free-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId, email, fullName, gender, quantity,
          tierId: selectedTier?.id || null,
          tierName: selectedTier?.name || (isLegacyEvent ? "Standard" : null),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to claim ticket");

      fetch("/api/send-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, eventTitle, ticketId: result.ticketId, amount: 0 }),
      });

      onOpenChange(false);
      resetForm();
      router.push(`/tickets/${result.ticketId}`);
    } catch (err: any) {
      alert("Could not claim ticket: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuccess = async (reference: PaystackSuccessResponse) => {
    setPaystackActive(false);
    document.body.style.overflow = "";
    setIsSaving(true);
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.reference,
          eventId, email, fullName, gender, quantity,
          tierId: selectedTier?.id || null,
          tierName: selectedTier?.name || (isLegacyEvent ? "Standard" : null),
          price: finalPrice, fee,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Payment verification failed");

      fetch("/api/send-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, eventTitle, ticketId: result.ticketId, amount: totalAmount }),
      });

      onOpenChange(false);
      resetForm();
      router.push(`/tickets/${result.ticketId}`);
    } catch (error: any) {
      alert("Ticket processing failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const componentProps: any = {
    email,
    amount: Math.round(totalAmount * 100),
    publicKey: PAYSTACK_KEY || "",
    text: `Pay ₦${totalAmount.toLocaleString()}`,
    onSuccess: handleSuccess,
    onClose: () => {
      setPaystackActive(false);
      document.body.style.overflow = "";
    },
    ...(subaccountCode ? { subaccount: subaccountCode, bearer: "subaccount" } : {}),
  };

  const canProceed = !!email && validateEmail(email) && !!fullName && !emailError;

  if (!open) return null;

  return (
    <>
      {/* Backdrop — hidden when Paystack is active so its own UI shows cleanly */}
      {!paystackActive && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Modal — hidden when Paystack is active to avoid visual interference */}
      {!paystackActive && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", maxHeight: "92vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Brand top bar */}
            <div className="h-1 w-full grad-brand" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid var(--card-border)" }}>
              <h2 className="font-display font-bold text-lg pr-4 truncate" style={{ color: "var(--text-primary)" }}>
                {eventTitle}
              </h2>
              <button onClick={() => onOpenChange(false)}
                className="p-2 rounded-xl transition hover:opacity-70 flex-shrink-0"
                style={{ color: "var(--text-muted)" }}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 pb-6" style={{ maxHeight: "calc(92vh - 80px)" }}>
              <div className="space-y-5 pt-4">

                {/* Tier selection */}
                {tiers.length > 1 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium" style={labelStyle}>Select Ticket Type</label>
                    <div className="grid gap-2">
                      {tiers.map(tier => {
                        const soldOut = tier.remaining !== undefined && tier.remaining <= 0;
                        const isSelected = selectedTier?.id === tier.id;
                        return (
                          <div key={tier.id}
                            onClick={() => !soldOut && setSelectedTier(tier)}
                            className="p-3 rounded-xl transition-all flex items-center justify-between"
                            style={{
                              border: isSelected && !soldOut
                                ? `2px solid var(--brand-indigo)`
                                : `1px solid var(--card-border)`,
                              backgroundColor: isSelected && !soldOut
                                ? "rgba(72,0,130,0.07)"
                                : soldOut ? "rgba(0,0,0,0.03)" : "var(--surface-raised)",
                              cursor: soldOut ? "not-allowed" : "pointer",
                              opacity: soldOut ? 0.5 : 1,
                            }}>
                            <div>
                              <p className="font-bold" style={{ color: "var(--text-primary)" }}>{tier.name}</p>
                              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                                {tier.price === 0 ? "Free" : `₦${tier.price.toLocaleString()}`}
                              </p>
                              {soldOut
                                ? <p className="text-xs font-semibold text-red-500 mt-0.5">Sold out</p>
                                : tier.remaining !== undefined && tier.remaining <= 20
                                ? <p className="text-xs font-semibold text-orange-500 mt-0.5">{tier.remaining} left</p>
                                : null}
                            </div>
                            {isSelected && !soldOut && (
                              <div className="text-white p-1 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--brand-indigo)" }}>
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                            {soldOut && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ border: "1px solid var(--card-border)", color: "var(--text-muted)" }}>
                                Sold Out
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity + form */}
                {(isLegacyEvent || selectedTier) && (
                  <>
                    {/* Quantity row */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block font-semibold" style={{ color: "var(--text-primary)" }}>
                            {selectedTier ? `${selectedTier.name} Ticket` : "Standard Ticket"}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {finalPrice === 0 ? "Free" : `₦${finalPrice.toLocaleString()} each`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            className="h-9 w-9 rounded-full flex items-center justify-center transition hover:opacity-80"
                            style={{ border: "1px solid var(--card-border)", color: "var(--text-primary)", backgroundColor: "var(--card-bg)" }}>
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center" style={{ color: "var(--text-primary)" }}>{quantity}</span>
                          <button
                            onClick={() => setQuantity(q => Math.min(isLegacyEvent ? Math.min(10, legacyRemaining ?? 10) : Math.min(10, selectedTier?.remaining ?? 10), q + 1))}
                            disabled={isLegacyEvent ? quantity >= (legacyRemaining ?? 10) : quantity >= (selectedTier?.remaining ?? 10)}
                            className="h-9 w-9 rounded-full flex items-center justify-center transition hover:opacity-80 disabled:opacity-40"
                            style={{ border: "1px solid var(--card-border)", color: "var(--text-primary)", backgroundColor: "var(--card-bg)" }}>
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const rem = isLegacyEvent ? legacyRemaining : selectedTier?.remaining;
                        if (!rem || rem > 20) return null;
                        return rem <= 0
                          ? <p className="text-xs font-semibold text-red-500 mt-2">This ticket type is sold out.</p>
                          : <p className="text-xs font-semibold text-orange-500 mt-2">Only {rem} ticket{rem !== 1 ? "s" : ""} remaining!</p>;
                      })()}
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="text-sm font-medium block mb-1.5" style={labelStyle}>Full Name</label>
                      <input type="text" placeholder="Enter your full name" value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={inputStyle} />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="text-sm font-medium block mb-1.5" style={labelStyle}>Gender</label>
                      <select value={gender} onChange={e => setGender(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={inputStyle}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-sm font-medium block mb-1.5" style={labelStyle}>
                        Where should we send your ticket?
                      </label>
                      <input type="email" placeholder="Enter your email" value={email}
                        onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                        onBlur={() => { if (email && !validateEmail(email)) setEmailError("Please enter a valid email address"); }}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{ ...inputStyle, border: emailError ? "1px solid #f87171" : "1px solid var(--input-border)" }} />
                      {emailError && <p className="text-red-500 text-xs mt-1.5">{emailError}</p>}
                    </div>

                    {/* Price summary */}
                    <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "16px" }}>
                      {isFree ? (
                        <div className="flex justify-between items-center">
                          <span className="font-bold" style={{ color: "var(--text-primary)" }}>Total</span>
                          <span className="text-2xl font-bold text-green-500">Free</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm" style={{ color: "var(--text-muted)" }}>
                            <span>Subtotal</span><span>₦{subtotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm" style={{ color: "var(--text-muted)" }}>
                            <span>Service Fee (5%)</span><span>₦{fee.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid var(--card-border)" }}>
                            <span className="font-bold" style={{ color: "var(--text-primary)" }}>Total</span>
                            <span className="text-2xl font-bold" style={{ color: "var(--brand-indigo)" }}>
                              ₦{totalAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="pb-2">
                      {isSaving ? (
                        <button disabled
                          className="w-full text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 opacity-70"
                          style={{ backgroundColor: "var(--brand-indigo)" }}>
                          <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                        </button>
                      ) : isFree ? (
                        <button onClick={handleClaimFree} disabled={!canProceed}
                          className="w-full text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: "var(--brand-indigo)" }}>
                          Claim Free Ticket
                        </button>
                      ) : (
                        // Paystack button rendered outside any overflow container
                        <div className="w-full rounded-xl overflow-hidden" style={{ backgroundColor: "var(--brand-indigo)" }}>
                          <PaystackButton
                            {...componentProps}
                            onClick={() => {
                              if (!canProceed) return;
                              // Hide our modal + backdrop before Paystack opens
                              // so Paystack has a clean, unobstructed viewport
                              setPaystackActive(true);
                              document.body.style.overflow = "";
                            }}
                            disabled={!canProceed}
                            className={`w-full py-4 font-bold text-lg text-white bg-transparent hover:opacity-90 transition ${!canProceed ? "opacity-50 cursor-not-allowed" : ""}`}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!isLegacyEvent && !selectedTier && tiers.length > 0 && (
                  <p className="text-center text-sm pb-2" style={{ color: "var(--text-muted)" }}>
                    Please select a ticket type to continue.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
