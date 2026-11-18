import type { SupabaseClient } from '@supabase/supabase-js';
import { bulkUnitPrice, discountedUnitPrice, discountLabel, normalizeCode, type DiscountTerms } from './discountMath';

/** Server-only: checks a buyer's code and prices the order with it. */

export interface DiscountCodeRow extends DiscountTerms {
  id: string;
  event_id: string;
  code: string;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  one_per_email: boolean;
  tier_ids: string[] | null;
  is_active: boolean;
}

export type ResolvedDiscount =
  | { ok: true; code: DiscountCodeRow; unitPrice: number; basePrice: number; label: string; terms: DiscountTerms }
  | { ok: false; error: string };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });

export async function resolveDiscount(
  supabase: SupabaseClient,
  { eventId, tierId, rawCode, quantity, email }: {
    eventId: string; tierId: string | null; rawCode: unknown; quantity: number; email?: string | null;
  }
): Promise<ResolvedDiscount> {
  const codeText = normalizeCode(rawCode);
  if (!codeText) return { ok: false, error: "That code doesn't look right — codes are 3 to 20 letters or numbers." };

  const { data: code } = await supabase
    .from('discount_codes')
    .select('id, event_id, code, discount_type, amount, starts_at, ends_at, max_uses, one_per_email, tier_ids, stacks_with_bulk, is_active')
    .eq('event_id', eventId)
    .eq('code', codeText)
    .maybeSingle<DiscountCodeRow>();

  if (!code || !code.is_active) {
    return { ok: false, error: `"${codeText}" isn't a valid code for this event. Check the spelling and try again.` };
  }
  const now = Date.now();
  if (code.starts_at && Date.parse(code.starts_at) > now) {
    return { ok: false, error: `"${codeText}" isn't active yet — it starts ${fmtDate(code.starts_at)}.` };
  }
  if (code.ends_at && Date.parse(code.ends_at) <= now) {
    return { ok: false, error: `"${codeText}" has expired — it ended ${fmtDate(code.ends_at)}.` };
  }

  // Price the order from the DB.
  let basePrice: number;
  let bulkPrice: number;
  if (tierId) {
    const { data: tier } = await supabase
      .from('ticket_tiers')
      .select('event_id, name, price, is_hidden, min_quantity, bulk_discount_qty, bulk_discount_percent')
      .eq('id', tierId)
      .single();
    if (!tier || tier.event_id !== eventId || tier.is_hidden) {
      return { ok: false, error: 'Pick a ticket type first, then apply your code.' };
    }
    if (code.tier_ids?.length && !code.tier_ids.includes(tierId)) {
      return { ok: false, error: `"${codeText}" can't be used on ${tier.name} tickets. It only works on certain ticket types.` };
    }
    basePrice = Number(tier.price) || 0;
    bulkPrice = bulkUnitPrice(basePrice, tier, quantity);
  } else {
    if (code.tier_ids?.length) {
      return { ok: false, error: `"${codeText}" can't be used on this ticket.` };
    }
    const { data: event } = await supabase.from('events').select('price').eq('id', eventId).single();
    basePrice = Number(event?.price) || 0;
    bulkPrice = basePrice;
  }
  if (basePrice <= 0) return { ok: false, error: 'This ticket is already free — no code needed.' };

  // Friendly early answer for the usage limits. The authoritative check runs
  // under a lock in reserve_discounted_tickets when the buyer pays.
  if (code.max_uses != null || (code.one_per_email && email)) {
    const { data: holds } = await supabase
      .from('ticket_holds')
      .select('quantity, email, status, expires_at')
      .eq('discount_code_id', code.id);
    const live = (holds || []).filter(h => h.status === 'consumed' || (h.status === 'active' && Date.parse(h.expires_at) > now));
    if (code.max_uses != null) {
      const used = live.reduce((s, h) => s + Number(h.quantity), 0);
      const left = code.max_uses - used;
      if (left <= 0) return { ok: false, error: `"${codeText}" has been fully used up — all ${code.max_uses} discounted tickets are gone.` };
      if (quantity > left) return { ok: false, error: `Only ${left} more ticket${left === 1 ? '' : 's'} can be bought with "${codeText}". Lower your quantity to use it.` };
    }
    if (code.one_per_email && email && live.some(h => (h.email || '').toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: `"${codeText}" can only be used once per person, and it's already been used with ${email}.` };
    }
  }

  const terms: DiscountTerms = { discount_type: code.discount_type, amount: Number(code.amount), stacks_with_bulk: code.stacks_with_bulk };
  const unitPrice = discountedUnitPrice(basePrice, bulkPrice, terms);
  return { ok: true, code, unitPrice, basePrice, label: discountLabel(terms), terms };
}

/** Plain-English messages for reserve_discounted_tickets' failure reasons. */
export function reserveDiscountError(reason: string, codeText: string, remaining?: number): string | null {
  if (reason === 'CODE_INVALID') return `"${codeText}" is no longer valid for this event — remove it to pay the normal price.`;
  if (reason === 'CODE_ALREADY_USED') return `"${codeText}" can only be used once per person, and you've already used it.`;
  if (reason === 'CODE_USED_UP') {
    return remaining && remaining > 0
      ? `Only ${remaining} more ticket${remaining === 1 ? '' : 's'} can be bought with "${codeText}". Lower your quantity to use it.`
      : `"${codeText}" was just used up by other buyers — remove it to pay the normal price.`;
  }
  return null;
}
