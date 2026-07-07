import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from '@/lib/sendTicketEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, email, fullName, gender, quantity, tierId, tierName, referralCode } = body;

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

    // --- 2. Server-side price verification — frontend cannot self-certify free ---
    // Always read price from the database, never trust the client
    let verifiedPrice: number;

    if (tierId) {
      // Tiered event: fetch tier price AND confirm it belongs to this event
      const { data: tier, error: tierErr } = await supabase
        .from('ticket_tiers')
        .select('price, event_id, quantity_available')
        .eq('id', tierId)
        .single();

      if (tierErr || !tier) {
        return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
      }

      // Confirm tier actually belongs to the requested event
      if (tier.event_id !== eventId) {
        console.error(`[claim-free-ticket] Tier mismatch: tierId=${tierId} belongs to event=${tier.event_id}, not ${eventId}`);
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }

      verifiedPrice = tier.price;
    } else {
      // Legacy event: fetch price from events table
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .select('price')
        .eq('id', eventId)
        .single();

      if (eventErr || !event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      verifiedPrice = event.price;
    }

    // --- 3. Reject if this is not actually a free ticket ---
    if (verifiedPrice > 0) {
      console.error(`[claim-free-ticket] Attempt to claim paid ticket for free: eventId=${eventId}, tierId=${tierId}, price=${verifiedPrice}`);
      return NextResponse.json(
        { error: 'This ticket requires payment. Use the standard checkout.' },
        { status: 403 }
      );
    }

    // --- 3b. Anti-bulk-buying: max 6 tickets per email per event ---
    const { count: alreadyOwned } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_email', email.toLowerCase())
      .in('status', ['valid', 'scanned']);

    if ((alreadyOwned || 0) + quantity > 6) {
      const remaining = Math.max(0, 6 - (alreadyOwned || 0));
      return NextResponse.json(
        { error: remaining <= 0
            ? 'You have already reached the maximum tickets allowed for this event.'
            : `You can only claim ${remaining} more ticket${remaining === 1 ? '' : 's'} for this event.` },
        { status: 409 }
      );
    }

    // --- 4. Check inventory to prevent overselling ---
    if (tierId) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('quantity_available')
        .eq('id', tierId)
        .single();

      const { count: soldCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('tier_id', tierId)
        .eq('status', 'valid');

      const remaining = (tier?.quantity_available || 0) - (soldCount || 0);
      if (remaining < quantity) {
        return NextResponse.json(
          { error: remaining <= 0 ? 'This ticket tier is sold out' : `Only ${remaining} ticket(s) left` },
          { status: 409 }
        );
      }
    } else {
      const { data: event } = await supabase
        .from('events')
        .select('total_tickets')
        .eq('id', eventId)
        .single();

      const { count: soldCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'valid');

      const remaining = (event?.total_tickets || 0) - (soldCount || 0);
      if (remaining < quantity) {
        return NextResponse.json(
          { error: remaining <= 0 ? 'This event is sold out' : `Only ${remaining} ticket(s) left` },
          { status: 409 }
        );
      }
    }

    // --- 5. Create unique base reference for this free claim ---
    const baseRef = `FREE-${crypto.randomUUID()}`;

    // --- 6. Insert verified free tickets ---
    const ticketsToCreate = Array.from({ length: quantity }, (_, i) => ({
      event_id: eventId,
      user_email: email,
      user_name: fullName,
      user_gender: gender || null,
      status: 'valid',
      purchase_reference: quantity > 1 ? `${baseRef}-${i + 1}` : baseRef,
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
      throw error;
    }

    // Send confirmation email server-side (must await — see verify-payment for why).
    const { data: eventRow } = await supabase.from('events').select('title').eq('id', eventId).single();
    try {
      const { error: emailError } = await sendTicketEmail({
        email,
        eventTitle: eventRow?.title || 'your event',
        ticketIds: data.map(t => t.id),
        amount: 0,
      });
      if (emailError) console.error('[claim-free-ticket] Ticket email failed:', emailError);
    } catch (emailErr) {
      console.error('[claim-free-ticket] Ticket email threw:', emailErr);
    }

    return NextResponse.json({ ticketIds: data.map(t => t.id) });
  } catch (err: any) {
    console.error('[claim-free-ticket] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
