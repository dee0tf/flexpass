import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from '@/lib/sendTicketEmail';
import { logPaymentEvent } from '@/lib/logPaymentEvent';
import { createTicketsAtomic } from '@/lib/createTicketsAtomic';
import { ticketGender } from '@/lib/gender';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { eventId, tierId, email, fullName, gender, genders } = body;
    const quantity = body.quantity && Number(body.quantity) > 0 ? Number(body.quantity) : 1;

    // --- 1. Input validation ---
    if (!eventId || !tierId || !email || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // --- 2. Confirm the requester owns this event ---
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, user_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // --- 3. Fetch the tier and confirm it's a hidden (sponsored) tier for this event ---
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, event_id, name, price, quantity_available, group_size, is_hidden')
      .eq('id', tierId)
      .single();

    if (tierErr || !tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });

    if (tier.event_id !== eventId) {
      console.error(`[issue-ticket] Tier mismatch: tierId=${tierId} belongs to event=${tier.event_id}, not ${eventId}`);
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'tier_mismatch', status: 'error',
        eventId, email, message: `tierId=${tierId} belongs to event=${tier.event_id}, not ${eventId}`,
      });
      return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
    }

    // This route only ever grants free tickets bypassing payment — it must
    // never be usable against a live paid tier, or it becomes a revenue-bypass bug.
    if (!tier.is_hidden) {
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'not_hidden_tier', status: 'error',
        eventId, email, message: `tierId=${tierId} is not a hidden/sponsored tier`,
      });
      return NextResponse.json({ error: 'This action is only available for sponsored tiers' }, { status: 400 });
    }

    // --- 4. Create the giveaway ticket(s) atomically — one row per
    // individual attendee. Capacity is checked and enforced inside
    // create_tickets_atomic under a row lock on the tier, so two
    // simultaneous issues for the last slot can't both succeed.
    const groupSize = tier.group_size || 1;
    const attendeeCount = quantity * groupSize;
    const baseRef = `GIVEAWAY-${crypto.randomUUID()}`;
    const ticketsToCreate = Array.from({ length: attendeeCount }, (_, i) => ({
      event_id: eventId,
      user_email: email,
      user_name: fullName,
      // Same rule as checkout: per-ticket pick, else the single fallback;
      // anything other than Male/Female is stored as null.
      user_gender: ticketGender(genders, gender, i),
      status: 'valid',
      is_giveaway: true,
      purchase_reference: attendeeCount > 1 ? `${baseRef}-${i + 1}` : baseRef,
      fee_amount: 0,
      total_amount_paid: 0,
      tier_id: tierId,
      tier_name: tier.name,
      referral_code: null,
    }));

    const result = await createTicketsAtomic(supabase, {
      tierId,
      eventId,
      quantity,
      tickets: ticketsToCreate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[];

    if (result.outcome === 'duplicate_reference') {
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'ticket_insert_failed', status: 'error',
        eventId, email, message: 'Duplicate purchase reference generated for giveaway issue',
        metadata: { attendeeCount, tierId },
      });
      return NextResponse.json({ error: 'Something went wrong, please try again' }, { status: 409 });
    } else if (result.outcome === 'sold_out' || result.outcome === 'tier_not_found') {
      const remaining = result.outcome === 'sold_out' ? result.remaining : 0;
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'oversold', status: 'error',
        eventId, email,
        message: result.outcome === 'sold_out'
          ? `tierId=${tierId} remaining=${remaining} requested=${quantity}`
          : `tierId=${tierId} not found`,
      });
      return NextResponse.json(
        { error: remaining <= 0 ? 'This sponsored tier is fully issued' : `Only ${remaining} left in this tier` },
        { status: 409 }
      );
    } else if (result.outcome === 'error') {
      console.error('[issue-ticket] Insert error:', result.message);
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'ticket_insert_failed', status: 'error',
        eventId, email, message: result.message, metadata: { attendeeCount, tierId },
      });
      throw new Error(result.message);
    } else {
      data = result.tickets;
    }

    await logPaymentEvent({
      source: 'issue-ticket', eventType: 'ticket_issued', status: 'success',
      eventId, email, message: `Issued ${data.length} giveaway ticket(s) for tier ${tier.name}`,
      metadata: { ticketIds: data.map(t => t.id), tierId },
    });

    // --- 6. Send confirmation email (must await — see verify-payment for why) ---
    try {
      const { error: emailError } = await sendTicketEmail({
        email,
        eventTitle: event.title,
        ticketIds: data.map(t => t.id),
        // The guest pays nothing (total_amount_paid stays 0 so host revenue
        // and payouts are untouched), but the email shows the ticket's real
        // value — a sponsored ticket isn't a "free" one.
        amount: (Number(tier.price) || 0) * quantity,
        sponsored: true,
      });
      if (emailError) {
        console.error('[issue-ticket] Ticket email failed:', emailError);
        await logPaymentEvent({
          source: 'issue-ticket', eventType: 'email_failed', status: 'error',
          eventId, email, message: JSON.stringify(emailError),
        });
      }
    } catch (emailErr) {
      console.error('[issue-ticket] Ticket email threw:', emailErr);
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'email_failed', status: 'error',
        eventId, email, message: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({ ticketIds: data.map(t => t.id) });
  } catch (err: any) {
    console.error('[issue-ticket] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
