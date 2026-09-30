import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logPaymentEvent } from '@/lib/logPaymentEvent';
import { sanitizeEmail } from '@/lib/sanitizeEmail';

// Service role — reserve_tickets / release_ticket_hold are service_role-only
// (see supabase/migrations/20261001_ticket_holds.sql).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// How long a buyer has to finish paying before their slot goes back on sale.
const HOLD_TTL_SECONDS = 600;
// Must match verify-payment / CheckoutModal.
const MAX_FLEXIBLE_GROUP_QUANTITY = 50;
const MAX_STANDARD_QUANTITY = 10;

/**
 * Reserves tickets for a paid checkout BEFORE Paystack opens, so the first
 * buyer to click Pay on the last slot(s) gets them and nobody else can pay
 * for the same slot in the meantime. Returns the reference the Paystack
 * charge must use — verify-payment/webhook match the hold by it.
 */
export async function POST(request: Request) {
  let eventId: string | undefined;
  let email: string | undefined;
  try {
    const body = await request.json();
    ({ eventId, email } = body);
    const { tierId, quantity } = body;
    if (typeof email === 'string') email = sanitizeEmail(email);

    if (!eventId || !email || typeof quantity !== 'number' || quantity < 1 || quantity > MAX_FLEXIBLE_GROUP_QUANTITY) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const { data: eventRow } = await supabase
      .from('events')
      .select('sales_end_date')
      .eq('id', eventId)
      .single();
    if (!eventRow) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (eventRow.sales_end_date && new Date(eventRow.sales_end_date) < new Date()) {
      return NextResponse.json({ error: 'Ticket sales have closed for this event' }, { status: 409 });
    }

    let groupSize = 1;
    let isFlexibleGroup = false;
    if (tierId) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('event_id, group_size, min_quantity, ends_at')
        .eq('id', tierId)
        .single();
      if (!tier || tier.event_id !== eventId) {
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }
      if (tier.ends_at && new Date(tier.ends_at) < new Date()) {
        return NextResponse.json({ error: 'Sales for this ticket type have ended' }, { status: 409 });
      }
      groupSize = tier.group_size || 1;
      isFlexibleGroup = !!tier.min_quantity;
      if (tier.min_quantity ? quantity < tier.min_quantity : quantity > MAX_STANDARD_QUANTITY) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }
    }

    // Same per-buyer cap verify-payment enforces — checked up front too, so
    // a buyer over the limit is stopped before paying rather than after.
    const bulkCap = isFlexibleGroup ? MAX_FLEXIBLE_GROUP_QUANTITY : 6;
    const { count: alreadyOwned } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_email', email.toLowerCase())
      .in('status', ['valid', 'scanned']);
    if ((alreadyOwned || 0) + quantity * groupSize > bulkCap) {
      const remaining = Math.max(0, bulkCap - (alreadyOwned || 0));
      return NextResponse.json(
        { error: remaining <= 0
            ? `You have already reached the maximum tickets allowed for this event (${bulkCap} per person).`
            : `You can only buy ${remaining} more ticket${remaining === 1 ? '' : 's'} for this event.` },
        { status: 409 }
      );
    }

    // One live hold per buyer per event — reopening checkout replaces the
    // previous hold instead of stacking up slots nobody is paying for.
    await supabase
      .from('ticket_holds')
      .update({ status: 'released' })
      .eq('event_id', eventId)
      .eq('email', email.toLowerCase())
      .eq('status', 'active');

    const reference = `FP-${crypto.randomUUID()}`;
    const { data, error } = await supabase.rpc('reserve_tickets', {
      p_tier_id: tierId || null,
      p_event_id: eventId,
      p_quantity: quantity,
      p_email: email.toLowerCase(),
      p_reference: reference,
      p_ttl_seconds: HOLD_TTL_SECONDS,
    });

    if (error) throw new Error(error.message);

    if (!data?.ok) {
      if (data?.reason === 'HELD') {
        const mins = data.next_release_at
          ? Math.max(1, Math.ceil((new Date(data.next_release_at).getTime() - Date.now()) / 60000))
          : Math.ceil(HOLD_TTL_SECONDS / 60);
        return NextResponse.json(
          {
            error: data.remaining > 0
              ? `Only ${data.remaining} left right now — someone else is paying for the rest. Try a smaller quantity, or try again in about ${mins} minute${mins === 1 ? '' : 's'}.`
              : `Someone else is currently paying for the last ticket(s). If they don't complete payment it'll be released — try again in about ${mins} minute${mins === 1 ? '' : 's'}.`,
            reason: 'HELD',
          },
          { status: 409 }
        );
      }
      if (data?.reason === 'TIER_NOT_FOUND') {
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }
      return NextResponse.json(
        { error: data?.remaining > 0 ? `Only ${data.remaining} left` : 'This ticket type is sold out', reason: 'SOLD_OUT' },
        { status: 409 }
      );
    }

    return NextResponse.json({ reference, expiresAt: data.expires_at });
  } catch (err: unknown) {
    console.error('[ticket-hold] Unhandled error:', err);
    await logPaymentEvent({
      source: 'checkout-funnel', eventType: 'hold_failed', status: 'error',
      eventId, email, message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Could not reserve tickets, please try again' }, { status: 500 });
  }
}

/**
 * Buyer closed Paystack without paying — release the hold so the slot goes
 * straight back on sale instead of waiting for it to expire. Only ever
 * releases an active hold; a paid (consumed) one is untouched.
 */
export async function DELETE(request: Request) {
  try {
    const { reference } = await request.json();
    if (typeof reference !== 'string' || !reference.startsWith('FP-') || reference.length > 100) {
      return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
    }
    const { error } = await supabase.rpc('release_ticket_hold', { p_reference: reference });
    if (error) throw new Error(error.message);
    return NextResponse.json({ released: true });
  } catch (err: unknown) {
    console.error('[ticket-hold] Release failed:', err);
    return NextResponse.json({ error: 'Could not release hold' }, { status: 500 });
  }
}
