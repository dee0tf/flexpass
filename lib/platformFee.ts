/**
 * FlexPass charges a 5% service fee on top of the ticket price (see
 * CheckoutModal.tsx), baked into total_amount_paid rather than always split
 * out in the tickets.fee_amount column — tickets created via the
 * webhook/reconciliation fallback path record fee_amount as 0 even though
 * the buyer paid the fee. Reconstructing from the total holds regardless of
 * which path created the ticket.
 */
const FEE_PERCENTAGE = 0.05;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function platformFeeFromGross(totalAmountPaid: number | null | undefined): number {
  const total = totalAmountPaid || 0;
  if (total <= 0) return 0;
  const subtotal = total / (1 + FEE_PERCENTAGE);
  return total - subtotal;
}

/** What a buyer pays at checkout for one ticket at this price. */
export function buyerTotalFor(price: number): number {
  return round2(price * (1 + FEE_PERCENTAGE));
}

/**
 * Checkout amounts. The total is the per-ticket buyer price × quantity, so
 * a tier set to a round buyer total (₦7,500) stays round at any quantity.
 * For whole-naira prices this is identical to adding 5% to the subtotal.
 * The fee is floored to the kobo so verify-payment's
 * `price × qty + fee <= paid` check can never come out a kobo over.
 */
export function checkoutTotals(unitPrice: number, quantity = 1) {
  const total = round2(buyerTotalFor(unitPrice) * quantity);
  const fee = Math.max(0, Math.floor((total - unitPrice * quantity) * 100 + 1e-6) / 100);
  return { subtotal: round2(unitPrice * quantity), fee, total };
}

/**
 * Inverse of buyerTotalFor: the ticket price (host's share) that makes
 * checkout land exactly on `total`. FlexPass's cut is still 5% of that
 * price — only the split moves, never the rate. About 1 in 20 round totals
 * can't be hit with a price to the kobo, so those fall back to 3 decimals.
 */
export function priceForBuyerTotal(total: number): number {
  const target = round2(total);
  for (const scale of [100, 1000]) {
    const base = Math.round((target / (1 + FEE_PERCENTAGE)) * scale) / scale;
    for (const step of [0, 1, -1, 2, -2, 3, -3]) {
      const candidate = Math.round((base + step / scale) * scale) / scale;
      if (buyerTotalFor(candidate) === target) return candidate;
    }
  }
  return round2(target / (1 + FEE_PERCENTAGE));
}

/** Next "clean" buyer total above `total`, or null if it's already clean. */
export function nextRoundBuyerTotal(total: number): number | null {
  const step = total < 2000 ? 100 : total < 20000 ? 500 : 1000;
  const rounded = Math.ceil(total / step) * step;
  return rounded === total ? null : rounded;
}
