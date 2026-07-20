/**
 * FlexPass charges a 5% service fee on top of the ticket price (see
 * CheckoutModal.tsx), baked into total_amount_paid rather than always split
 * out in the tickets.fee_amount column — tickets created via the
 * webhook/reconciliation fallback path record fee_amount as 0 even though
 * the buyer paid the fee. Reconstructing from the total holds regardless of
 * which path created the ticket.
 */
const FEE_PERCENTAGE = 0.05;

export function platformFeeFromGross(totalAmountPaid: number | null | undefined): number {
  const total = totalAmountPaid || 0;
  if (total <= 0) return 0;
  const subtotal = total / (1 + FEE_PERCENTAGE);
  return total - subtotal;
}
