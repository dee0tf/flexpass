"use client";

import { getCheckoutSessionId } from "@/lib/checkoutSession";

export type CheckoutFunnelEventType =
  | "checkout_opened"
  | "checkout_initiated"
  | "checkout_abandoned";

interface TrackCheckoutEventArgs {
  eventId: string;
  email?: string | null;
  tierId?: string | null;
  tierName?: string | null;
  quantity?: number | null;
  isFree?: boolean;
}

// Fire-and-forget: a tracking failure must never surface to the buyer or
// block the checkout flow it's observing.
export function trackCheckoutEvent(
  eventType: CheckoutFunnelEventType,
  args: TrackCheckoutEventArgs
) {
  try {
    fetch("/api/track-checkout-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        sessionId: getCheckoutSessionId(),
        ...args,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no-op
  }
}
