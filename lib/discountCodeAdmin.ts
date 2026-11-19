import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Shared helpers for the host-facing /api/discount-codes routes. */

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
export const db: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CODE_COLUMNS =
  'id, event_id, code, discount_type, amount, starts_at, ends_at, max_uses, one_per_email, tier_ids, excluded_tier_ids, stacks_with_bulk, is_active, created_at';

export type OwnerCheck =
  | { error: string; status: 401 | 403 | 404 }
  | { user: { id: string } };

/** The signed-in user, if they own the event. */
export async function requireEventOwner(request: Request, eventId: string): Promise<OwnerCheck> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { error: 'Please log in again.', status: 401 as const };
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) return { error: 'Please log in again.', status: 401 as const };
  if (!UUID_RE.test(eventId)) return { error: 'Event not found.', status: 404 as const };
  const { data: event } = await db.from('events').select('id, user_id').eq('id', eventId).single();
  if (!event) return { error: 'Event not found.', status: 404 as const };
  if (event.user_id !== user.id) return { error: "You can only manage discount codes for your own events.", status: 403 as const };
  return { user };
}

/** Tickets (units) sold or mid-payment per code, from the ticket holds. */
export async function usageByCode(codeIds: string[]): Promise<Record<string, { used: number; orders: number }>> {
  const out: Record<string, { used: number; orders: number }> = {};
  if (!codeIds.length) return out;
  const { data } = await db
    .from('ticket_holds')
    .select('discount_code_id, quantity, status')
    .in('discount_code_id', codeIds)
    .eq('status', 'consumed');
  for (const h of data || []) {
    const k = h.discount_code_id as string;
    out[k] ??= { used: 0, orders: 0 };
    out[k].used += Number(h.quantity) || 0;
    out[k].orders += 1;
  }
  return out;
}
