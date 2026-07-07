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
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { eventId, tierId, email, fullName, gender } = body;
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

    // --- 3. Fetch the tier and confirm it's a hidden/giveaway tier for this event ---
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, event_id, name, quantity_available, group_size, is_hidden')
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
        eventId, email, message: `tierId=${tierId} is not a hidden/giveaway tier`,
      });
      return NextResponse.json({ error: 'This action is only available for hidden/giveaway tiers' }, { status: 400 });
    }

    // --- 4. Capacity check — mirrors claim-free-ticket's group_size-aware math ---
    const groupSize = tier.group_size || 1;
    const { count: soldCount } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('tier_id', tierId)
      // Include 'scanned' as well as 'valid' — a checked-in ticket still
      // occupies a slot in this tier and must keep counting against
      // capacity, or capacity appears to free up as attendees check in.
      .in('status', ['valid', 'scanned']);

    const groupsSold = (soldCount || 0) / groupSize;
    const remaining = tier.quantity_available - groupsSold;
    if (remaining < quantity) {
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'oversold', status: 'error',
        eventId, email, message: `tierId=${tierId} remaining=${remaining} requested=${quantity}`,
      });
      return NextResponse.json(
        { error: remaining <= 0 ? 'This giveaway tier is exhausted' : `Only ${remaining} left in this tier` },
        { status: 409 }
      );
    }

    // --- 5. Create the giveaway ticket(s) — one row per individual attendee ---
    const attendeeCount = quantity * groupSize;
    const baseRef = `GIVEAWAY-${crypto.randomUUID()}`;
    const ticketsToCreate = Array.from({ length: attendeeCount }, (_, i) => ({
      event_id: eventId,
      user_email: email,
      user_name: fullName,
      user_gender: gender || null,
      status: 'valid',
      is_giveaway: true,
      purchase_reference: attendeeCount > 1 ? `${baseRef}-${i + 1}` : baseRef,
      fee_amount: 0,
      total_amount_paid: 0,
      tier_id: tierId,
      tier_name: tier.name,
      referral_code: null,
    }));

    const { data, error } = await supabase
      .from('tickets')
      .insert(ticketsToCreate)
      .select();

    if (error) {
      console.error('[issue-ticket] Insert error:', error);
      await logPaymentEvent({
        source: 'issue-ticket', eventType: 'ticket_insert_failed', status: 'error',
        eventId, email, message: error.message, metadata: { attendeeCount, tierId },
      });
      throw error;
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
        amount: 0,
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
