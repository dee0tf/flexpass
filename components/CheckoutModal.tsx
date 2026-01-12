"use client";

import { useState } from "react";
import { Plus, Minus, Loader2 } from "lucide-react";
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

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  price: number;
  eventId: string;
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
  price,
  eventId,
}: CheckoutModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- INITIALIZE ROUTER ---
  const router = useRouter();

  const totalAmount = price * quantity;

  // 2. The Success Logic
  const handleSuccess = async (reference: PaystackSuccessResponse) => {
    // --- THIS LOG WILL NOW WORK ---
    console.log("✅ COMPONENT SUCCESS! Processing Order...", {
        eventId: eventId,
        ref: reference.reference
    });

    setIsSaving(true);
    try {
      const ticketsToCreate = Array.from({ length: quantity }).map(() => ({
        event_id: eventId,
        user_email: email,
        status: "valid",
        purchase_reference: reference.reference,
      }));

      // --- 1. Save to Database ---
      const { data, error } = await supabase
        .from("tickets")
        .insert(ticketsToCreate)
        .select();

      if (error) throw error;

      const newTicketId = data[0].id; // Get ID of the first ticket

      // --- 2. NEW: Send Email Receipt (Background Task) ---
      // We don't await this because we don't want to block the redirect if email is slow
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
      
      // Redirect to the new Ticket Page
      router.push(`/tickets/${newTicketId}`);

    } catch (error: unknown) {
      console.error("Database Error:", error);
      alert("Payment received, but ticket save failed. Contact support.");
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
    text: "Pay Now",
    onSuccess: (ref: any) => handleSuccess(ref), // Explicitly bind success
    onClose: handleClose,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {eventTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl">
            <span className="text-slate-600 font-medium">Tickets</span>
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
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600">Total</span>
              <span className="text-2xl font-bold text-[#581c87]">
                ₦{totalAmount.toLocaleString()}
              </span>
            </div>

            {/* 4. SWITCH LOGIC: 
                If saving, show Spinner. 
                If not saving, show PaystackButton. 
            */}
            {isSaving ? (
                <button
                  disabled
                  className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold text-lg opacity-70 flex items-center justify-center gap-2"
                >
                   <Loader2 className="h-5 w-5 animate-spin" /> Processing...
                </button>
            ) : (
                <div className="w-full relative">
                    {/* Block click if no email */}
                    {!email && <div className="absolute inset-0 z-10" onClick={() => alert("Please enter your email")} />}
                    
                    <PaystackButton 
                        {...componentProps} 
                        className="w-full bg-gradient-to-b from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-indigo-200"
                    />
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}