/**
 * Discount-code price math, shared by checkout (preview) and the server
 * (/api/ticket-hold, which fixes the price the buyer is charged). Keep it
 * pure — no DB, no browser APIs — so both sides always agree.
 */

/** A code can never take more than this share off the price it applies to. */
export const MAX_DISCOUNT_SHARE = 0.5;

export interface DiscountTerms {
  discount_type: "percent" | "fixed";
  /** percent: 1–50. fixed: naira off per ticket (per table on table tiers). */
  amount: number;
  stacks_with_bulk: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Naira the code takes off one unit priced at `price`, capped at 50%. */
export function codeDiscountOn(price: number, terms: DiscountTerms): number {
  if (price <= 0) return 0;
  const raw = terms.discount_type === "percent"
    ? price * (Math.min(terms.amount, MAX_DISCOUNT_SHARE * 100) / 100)
    : terms.amount;
  return round2(Math.min(raw, price * MAX_DISCOUNT_SHARE));
}

/**
 * Final unit price with a code applied.
 *   basePrice — the tier's listed price (per table for table tiers)
 *   bulkPrice — the price after the tier's own bulk discount, or basePrice
 *               when no bulk discount is active for this quantity
 * Stacking: the code comes off the bulk price. Not stacking: the buyer gets
 * whichever is cheaper — the bulk price, or the code on the listed price.
 */
export function discountedUnitPrice(basePrice: number, bulkPrice: number, terms: DiscountTerms): number {
  if (terms.stacks_with_bulk) return round2(bulkPrice - codeDiscountOn(bulkPrice, terms));
  return round2(Math.min(bulkPrice, basePrice - codeDiscountOn(basePrice, terms)));
}

/** Same bulk-discount rule as orderPricing / CheckoutModal. */
export function bulkUnitPrice(
  price: number,
  tier: { min_quantity?: number | null; bulk_discount_qty?: number | null; bulk_discount_percent?: number | null },
  quantity: number
): number {
  return tier.min_quantity && tier.bulk_discount_qty && tier.bulk_discount_percent && quantity >= tier.bulk_discount_qty
    ? round2(price * (1 - tier.bulk_discount_percent / 100))
    : price;
}

/** "30% off" / "₦2,000 off" — shown to buyers and hosts. */
export function discountLabel(terms: Pick<DiscountTerms, "discount_type" | "amount">): string {
  return terms.discount_type === "percent"
    ? `${terms.amount}% off`
    : `₦${terms.amount.toLocaleString()} off`;
}

/** Codes are stored upper-case: 3–20 letters, digits, - or _. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,20}$/.test(code) ? code : null;
}
