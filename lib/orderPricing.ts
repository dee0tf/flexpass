import type { SupabaseClient } from '@supabase/supabase-js';
import { checkoutTotals } from './platformFee';

/**
 * Kobo of slack allowed per unit bought. The mobile app (and any cached old
 * web bundle) still rounds the fee on the whole subtotal, which can land a
 * kobo under the per-ticket formula on decimal prices. Never more than
 * pennies — the price and the 5% can't be dodged with it.
 */
export const UNDERPAY_TOLERANCE_KOBO = 1;

/**
 * A tier's ends_at is enforced before payment by /api/ticket-hold. This is
 * the backstop for charges that skipped the hold (e.g. an early-bird price
 * paid after the cutoff). The grace covers a buyer who got a hold just
 * before the cutoff and paid within its 10-minute window.
 */
const TIER_END_GRACE_MS = 15 * 60 * 1000;

/**
 * Server-side price of an order, built only from the DB — never from
 * anything the buyer's browser sent. Both ticket-creation paths
 * (verify-payment and the webhook fallback) check the Paystack amount
 * against this, so neither the ticket price nor FlexPass's 5% can be
 * skipped by editing a request or Paystack metadata.
 */
export async function expectedOrderPricing(
  supabase: SupabaseClient,
  { eventId, tierId, quantity, paidAt }: {
    eventId: string; tierId?: string | null; quantity: number;
    // When Paystack says the charge happened. The reconciliation job can run
    // hours later, so "has this tier's sale window closed?" must be judged
    // at payment time, not now.
    paidAt?: string | null;
  }
) {
  let unitPrice: number;
  let salesEnded = false;
  if (tierId) {
    const { data: tier } = await supabase
      .from('ticket_tiers')
      .select('price, event_id, min_quantity, bulk_discount_qty, bulk_discount_percent, ends_at')
      .eq('id', tierId)
      .single();
    if (!tier || tier.event_id !== eventId) return null;
    if (tier.ends_at) {
      const paidMs = paidAt ? Date.parse(paidAt) : Date.now();
      salesEnded = Date.parse(tier.ends_at) + TIER_END_GRACE_MS < (Number.isFinite(paidMs) ? paidMs : Date.now());
    }
    // Same bulk-discount math as CheckoutModal.
    unitPrice = tier.min_quantity && tier.bulk_discount_qty && tier.bulk_discount_percent && quantity >= tier.bulk_discount_qty
      ? Math.round(tier.price * (1 - tier.bulk_discount_percent / 100) * 100) / 100
      : tier.price;
  } else {
    const { data: event } = await supabase.from('events').select('price').eq('id', eventId).single();
    if (!event) return null;
    unitPrice = event.price || 0;
  }

  const { fee, total } = checkoutTotals(unitPrice, quantity);
  return { unitPrice, fee, total, expectedKobo: Math.round(total * 100), salesEnded };
}
