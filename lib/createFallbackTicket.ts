import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from './sendTicketEmail';
import { logPaymentEvent } from './logPaymentEvent';
import { createTicketsAtomic } from './createTicketsAtomic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Creates ticket(s) for a Paystack charge that never went through the normal
 * verify-payment path — used by both the webhook's real-time fallback and the
 * reconciliation job's periodic sweep, so the two can never drift apart.
 */
export async function createFallbackTicket({
  source,
  reference,
  metadata,
  amountKobo,
  customerEmail,
}: {
  source: 'webhook' | 'reconciliation';
  reference: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  amountKobo: number;
  customerEmail: string;
}): Promise<{ outcome: 'already_exists' | 'created' | 'insert_failed' | 'no_event_id'; ticketIds?: string[] }> {
  const quantity = metadata?.quantity && Number(metadata.quantity) > 0 ? Number(metadata.quantity) : 1;

  // verify-payment stores a bare reference for a single ticket, or
  // `${reference}-1`, `${reference}-2`, ... for multi-ticket purchases.
  // Checking both catches either case without needing quantity upfront.
  const { data: existingTickets } = await supabase
    .from('tickets')
    .select('id')
    .in('purchase_reference', [reference, `${reference}-1`]);

  if (existingTickets && existingTickets.length > 0) {
    await logPaymentEvent({
      source, eventType: 'ticket_already_exists', status: 'skipped',
      reference, eventId: metadata?.event_id || null, email: customerEmail || null,
      message: 'Ticket(s) already exist for this reference',
    });
    return { outcome: 'already_exists' };
  }

  if (!metadata?.event_id) {
    // This is a prime suspect for an unrecoverable purchase: metadata
    // missing event_id means we have no way to know what to create — e.g.
    // an old client bundle that predates metadata being attached.
    await logPaymentEvent({
      source, eventType: 'no_event_id_in_metadata', status: 'skipped',
      reference, email: customerEmail || null,
      message: 'metadata.event_id missing — cannot create fallback ticket', metadata,
    });
    return { outcome: 'no_event_id' };
  }

  // group_size (individual tickets per unit, e.g. 5 for a "Table of 5")
  // must come from the DB, never the client-supplied metadata.
  let groupSize = 1;
  if (metadata.tier_id) {
    const { data: tier } = await supabase
      .from('ticket_tiers')
      .select('group_size')
      .eq('id', metadata.tier_id)
      .single();
    groupSize = tier?.group_size || 1;
  }
  const attendeeCount = quantity * groupSize;

  const perTicketAmount = (amountKobo / 100) / attendeeCount;
  const ticketsToCreate = Array.from({ length: attendeeCount }, (_, i) => ({
    event_id: metadata.event_id,
    user_email: customerEmail,
    user_name: metadata.full_name || customerEmail,
    user_gender: metadata.gender || null,
    status: 'valid',
    purchase_reference: attendeeCount > 1 ? `${reference}-${i + 1}` : reference,
    fee_amount: 0,
    total_amount_paid: perTicketAmount,
    tier_id: metadata.tier_id || null,
    tier_name: metadata.tier_name || 'Standard',
    referral_code: metadata.referral_code || null,
  }));

  // Capacity check and insert happen atomically under a row lock (see
  // create_tickets_atomic). The fallback path only runs when verify-payment
  // never completed (e.g. buyer's connection dropped right after paying), so
  // it must not skip this and oversell a tier that's already sold out just
  // because the money already moved.
  const result = await createTicketsAtomic(supabase, {
    tierId: metadata.tier_id || null,
    eventId: metadata.event_id,
    quantity,
    tickets: ticketsToCreate,
  });

  if (result.outcome === 'duplicate_reference') {
    // A duplicate purchase_reference here means verify-payment (or the other
    // fallback path) won the race and already created the ticket(s) in the
    // split second after our pre-check above — not a real failure, just two
    // safety nets firing for the same purchase.
    await logPaymentEvent({
      source, eventType: 'ticket_already_exists', status: 'skipped',
      reference, eventId: metadata.event_id, email: customerEmail || null,
      message: 'Ticket(s) already created by a concurrent path for this reference',
    });
    return { outcome: 'already_exists' };
  }

  if (result.outcome === 'sold_out' || result.outcome === 'tier_not_found') {
    await logPaymentEvent({
      source, eventType: 'oversold', status: 'error',
      reference, eventId: metadata.event_id, email: customerEmail || null,
      message: result.outcome === 'sold_out'
        ? `Fallback ticket blocked: tierId=${metadata.tier_id || 'legacy'} remaining=${result.remaining} requested=${quantity}. Charge succeeded but tier is sold out - needs manual refund/resolution.`
        : `Fallback ticket blocked: tierId=${metadata.tier_id} not found. Charge succeeded but tier is missing - needs manual refund/resolution.`,
    });
    return { outcome: 'insert_failed' };
  }

  if (result.outcome === 'error') {
    console.error(`[${source}] Fallback ticket insert failed:`, result.message);
    await logPaymentEvent({
      source, eventType: 'fallback_insert_failed', status: 'error',
      reference, eventId: metadata.event_id, email: customerEmail,
      message: result.message, metadata: { attendeeCount, tierId: metadata.tier_id || null },
    });
    return { outcome: 'insert_failed' };
  }

  const inserted = result.tickets;

  console.warn(`[${source}] Created ${inserted.length} ticket(s) via fallback for reference=${reference}.`);
  await logPaymentEvent({
    source, eventType: 'fallback_ticket_created', status: 'success',
    reference, eventId: metadata.event_id, email: customerEmail,
    message: `Created ${inserted.length} ticket(s) via fallback`,
    metadata: { ticketIds: inserted.map(t => t.id) },
  });

  const { data: eventRow } = await supabase.from('events').select('title').eq('id', metadata.event_id).single();
  try {
    const { error: emailError } = await sendTicketEmail({
      email: customerEmail,
      eventTitle: eventRow?.title || 'your event',
      ticketIds: inserted.map(t => t.id),
      amount: amountKobo / 100,
    });
    if (emailError) {
      console.error(`[${source}] Fallback ticket email failed:`, emailError);
      await logPaymentEvent({
        source, eventType: 'email_failed', status: 'error',
        reference, eventId: metadata.event_id, email: customerEmail, message: JSON.stringify(emailError),
      });
    }
  } catch (emailErr) {
    console.error(`[${source}] Fallback ticket email threw:`, emailErr);
    await logPaymentEvent({
      source, eventType: 'email_failed', status: 'error',
      reference, eventId: metadata.event_id, email: customerEmail,
      message: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
  }

  return { outcome: 'created', ticketIds: inserted.map(t => t.id) };
}
