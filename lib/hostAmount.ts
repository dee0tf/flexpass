/**
 * A ticket's total_amount_paid includes FlexPass's service fee on top of the
 * ticket price (see CheckoutModal's 5% fee). Hosts should only ever see
 * their own share — the fee is FlexPass's revenue, not theirs.
 */
export function hostAmount(ticket: {
  total_amount_paid?: number | null;
  fee_amount?: number | null;
  events?: { price?: number | null } | null;
}): number {
  const gross = ticket.total_amount_paid ?? ticket.events?.price ?? 0;
  return gross - (ticket.fee_amount ?? 0);
}
