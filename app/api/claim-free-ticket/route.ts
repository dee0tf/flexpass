import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from '@/lib/sendTicketEmail';
import { logPaymentEvent } from '@/lib/logPaymentEvent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let eventId: string | undefined;
  let email: string | undefined;

  try {
    const body = await request.json();
    ({ eventId, email } = body);
    const { fullName, gender, quantity, tierId, tierName, referralCode } = body;

    // --- 1. Input validation ---
    if (!eventId || !email || !fullName || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (typeof quantity !== 'number' || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // --- 2. Fetch the event once — used for price (legacy events), the
    // sales cutoff check, oversell check, and the confirmation email title. ---
    const { data: eventRow, error: eventErr } = await supabase
      .from('events')
      .select('price, total_tickets, sales_end_date, title')
      .eq('id', eventId)
      .single();

    if (eventErr || !eventRow) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (eventRow.sales_end_date && new Date(eventRow.sales_end_date) < new Date()) {
      await logPaymentEvent({
        source: 'claim-free-ticket', eventType: 'sales_closed', status: 'error',
        eventId, email, message: `sales_end_date=${eventRow.sales_end_date}`,
      });
      return NextResponse.json({ error: 'Ticket sales have closed for this event' }, { status: 409 });
    }

    // --- 2a. Server-side price/tier verification — frontend cannot self-certify
    // free, and group_size (individual tickets per unit) must come from the
    // DB too, never the client. ---
    let verifiedPrice: number;
    let tierQuantityAvailable = 0;
    let groupSize = 1;

    if (tierId) {
      const { data: tier, error: tierErr } = await supabase
        .from('ticket_tiers')
        .select('price, event_id, quantity_available, group_size')
        .eq('id', tierId)
        .single();

      if (tierErr || !tier) {
        return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
      }

      // Confirm tier actually belongs to the requested event
      if (tier.event_id !== eventId) {
        console.error(`[claim-free-ticket] Tier mismatch: tierId=${tierId} belongs to event=${tier.event_id}, not ${eventId}`);
        await logPaymentEvent({
          source: 'claim-free-ticket', eventType: 'tier_mismatch', status: 'error',
          eventId, email, message: `tierId=${tierId} belongs to event=${tier.event_id}, not ${eventId}`,
        });
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }

      verifiedPrice = tier.price;
      tierQuantityAvailable = tier.quantity_available || 0;
      groupSize = tier.group_size || 1;
    } else {
      verifiedPrice = eventRow.price;
    }

    // --- 3. Reject if this is not actually a free ticket ---
    if (verifiedPrice > 0) {
      console.error(`[claim-free-ticket] Attempt to claim paid ticket for free: eventId=${eventId}, tierId=${tierId}, price=${verifiedPrice}`);
      await logPaymentEvent({
        source: 'claim-free-ticket', eventType: 'not_actually_free', status: 'error',
        eventId, email, message: `tierId=${tierId} price=${verifiedPrice}`,
      });
      return NextResponse.json(
        { error: 'This ticket requires payment. Use the standard checkout.' },
        { status: 403 }
      );
    }

    // Total individual attendee tickets this claim will issue.
    const attendeeCount = quantity * groupSize;

    // --- 3b. Anti-bulk-buying: max 6 individual tickets per email per event ---
    const { count: alreadyOwned } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_email', email.toLowerCase())
      .in('status', ['valid', 'scanned']);

    if ((alreadyOwned || 0) + attendeeCount > 6) {
      const remaining = Math.max(0, 6 - (alreadyOwned || 0));
      await logPaymentEvent({
        source: 'claim-free-ticket', eventType: 'anti_bulk_rejected', status: 'error',
        eventId, email, message: `alreadyOwned=${alreadyOwned} attendeeCount=${attendeeCount}`,
      });
      return NextResponse.json(
        { error: remaining <= 0
            ? 'You have already reached the maximum tickets allowed for this event.'
            : `You can only claim ${remaining} more ticket${remaining === 1 ? '' : 's'} for this event.` },
        { status: 409 }
      );
    }

    // --- 4. Check inventory to prevent overselling ---
    if (tierId) {
      const { count: soldCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('tier_id', tierId)
        // Include 'scanned' as well as 'valid' — a checked-in ticket still
        // occupies a slot and must keep counting against capacity, or
        // capacity appears to free up as attendees check in mid-event.
        .in('status', ['valid', 'scanned']);

      // soldCount counts individual ticket rows; quantity_available counts
      // groups/units, so convert back to the same unit before comparing.
      const groupsSold = (soldCount || 0) / groupSize;
      const remaining = tierQuantityAvailable - groupsSold;
      if (remaining < quantity) {
        await logPaymentEvent({
          source: 'claim-free-ticket', eventType: 'oversold', status: 'error',
          eventId, email, message: `tierId=${tierId} remaining=${remaining} requested=${quantity}`,
        });
        return NextResponse.json(
          { error: remaining <= 0 ? 'This ticket tier is sold out' : `Only ${remaining} left` },
          { status: 409 }
        );
      }
    } else {
      const { count: soldCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .in('status', ['valid', 'scanned']);

      const remaining = (eventRow.total_tickets || 0) - (soldCount || 0);
      if (remaining < quantity) {
        await logPaymentEvent({
          source: 'claim-free-ticket', eventType: 'oversold', status: 'error',
          eventId, email, message: `legacy event remaining=${remaining} requested=${quantity}`,
        });
        return NextResponse.json(
          { error: remaining <= 0 ? 'This event is sold out' : `Only ${remaining} ticket(s) left` },
          { status: 409 }
        );
      }
    }

    // --- 5. Create unique base reference for this free claim ---
    const baseRef = `FREE-${crypto.randomUUID()}`;

    // --- 6. Insert verified free tickets — one row per individual attendee ---
    const ticketsToCreate = Array.from({ length: attendeeCount }, (_, i) => ({
      event_id: eventId,
      user_email: email,
      user_name: fullName,
      user_gender: gender || null,
      status: 'valid',
      purchase_reference: attendeeCount > 1 ? `${baseRef}-${i + 1}` : baseRef,
      fee_amount: 0,
      total_amount_paid: 0,
      tier_id: tierId || null,
      tier_name: tierName || 'Free',
      referral_code: referralCode || null,
    }));

    const { data, error } = await supabase
      .from('tickets')
      .insert(ticketsToCreate)
      .select();

    if (error) {
      console.error('[claim-free-ticket] Insert error:', error);
      await logPaymentEvent({
        source: 'claim-free-ticket', eventType: 'ticket_insert_failed', status: 'error',
        eventId, email, message: error.message,
        metadata: { attendeeCount, tierId: tierId || null },
      });
      throw error;
    }

    await logPaymentEvent({
      source: 'claim-free-ticket', eventType: 'ticket_created', status: 'success',
      eventId, email, message: `Created ${data.length} ticket(s)`,
      metadata: { ticketIds: data.map(t => t.id) },
    });

    // Send confirmation email server-side (must await — see verify-payment for why).
    try {
      const { error: emailError } = await sendTicketEmail({
        email,
        eventTitle: eventRow?.title || 'your event',
        ticketIds: data.map(t => t.id),
        amount: 0,
      });
      if (emailError) {
        console.error('[claim-free-ticket] Ticket email failed:', emailError);
        await logPaymentEvent({
          source: 'claim-free-ticket', eventType: 'email_failed', status: 'error',
          eventId, email, message: JSON.stringify(emailError),
        });
      }
    } catch (emailErr) {
      console.error('[claim-free-ticket] Ticket email threw:', emailErr);
      await logPaymentEvent({
        source: 'claim-free-ticket', eventType: 'email_failed', status: 'error',
        eventId, email, message: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({ ticketIds: data.map(t => t.id) });
  } catch (err: any) {
    console.error('[claim-free-ticket] Unhandled error:', err);
    await logPaymentEvent({
      source: 'claim-free-ticket', eventType: 'unhandled_exception', status: 'error',
      eventId, email, message: err?.message || String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
