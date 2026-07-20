import { platformFeeFromGross } from "./platformFee";

/**
 * A ticket's total_amount_paid includes FlexPass's service fee on top of the
 * ticket price (see CheckoutModal's 5% fee). Hosts should only ever see
 * their own share — the fee is FlexPass's revenue, not theirs.
 *
 * The fee is reconstructed from total_amount_paid rather than read from the
 * fee_amount column: tickets created via the webhook/reconciliation
 * fallback path always record fee_amount as 0 even though the buyer paid
 * the fee, which was previously letting hosts see (and withdraw) FlexPass's
 * cut as part of their own balance.
 */
export function hostAmount(ticket: {
  total_amount_paid?: number | null;
  events?: { price?: number | null } | null;
}): number {
  const gross = ticket.total_amount_paid ?? ticket.events?.price ?? 0;
  return gross - platformFeeFromGross(gross);
}
