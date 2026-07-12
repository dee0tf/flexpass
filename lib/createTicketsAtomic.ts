import { SupabaseClient } from '@supabase/supabase-js';

export interface TicketToCreate {
  event_id: string;
  user_email: string;
  user_name: string;
  user_gender: string | null;
  status: string;
  is_giveaway?: boolean;
  purchase_reference: string;
  fee_amount: number;
  total_amount_paid: number;
  tier_id: string | null;
  tier_name: string;
  referral_code: string | null;
}

export type CreateTicketsResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { outcome: 'created'; tickets: any[] }
  | { outcome: 'sold_out'; remaining: number }
  | { outcome: 'tier_not_found' }
  | { outcome: 'duplicate_reference' }
  | { outcome: 'error'; message: string };

/**
 * Checks tier/event capacity and inserts the ticket rows in one atomic
 * database transaction (see supabase/migrations/20260712_create_tickets_atomic.sql),
 * so two simultaneous requests for the last remaining slot can't both succeed.
 */
export async function createTicketsAtomic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { tierId, eventId, quantity, tickets }: {
    tierId: string | null;
    eventId: string;
    quantity: number;
    tickets: TicketToCreate[];
  }
): Promise<CreateTicketsResult> {
  const { data, error } = await supabase.rpc('create_tickets_atomic', {
    p_tier_id: tierId,
    p_event_id: eventId,
    p_quantity: quantity,
    p_tickets: tickets,
  });

  if (error) {
    if (error.code === '23505') return { outcome: 'duplicate_reference' };
    return { outcome: 'error', message: error.message };
  }

  if (!data?.ok) {
    if (data?.reason === 'SOLD_OUT') return { outcome: 'sold_out', remaining: data.remaining ?? 0 };
    if (data?.reason === 'TIER_NOT_FOUND') return { outcome: 'tier_not_found' };
    return { outcome: 'error', message: 'Unknown failure creating tickets' };
  }

  return { outcome: 'created', tickets: data.tickets || [] };
}
