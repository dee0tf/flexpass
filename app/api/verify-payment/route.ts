import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reference, eventId, email, fullName, gender, quantity, tierId, tierName, price, fee } = body;

    // --- 1. Input validation ---
    if (!reference || !eventId || !email || !fullName || !quantity || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof quantity !== 'number' || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // --- 2. Prevent replay attacks (reference already used) ---
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('purchase_reference', reference)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Payment reference already used' }, { status: 409 });
    }

    // --- 3. Verify payment with Paystack server-side ---
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Payment verification unavailable' }, { status: 503 });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    if (!paystackRes.ok) {
      return NextResponse.json({ error: 'Failed to reach Paystack' }, { status: 502 });
    }

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // --- 4. Validate that the paid amount matches what we expect ---
    // Paystack returns amount in kobo; our price is in naira
    const paidKobo = paystackData.data.amount;
    const expectedKobo = Math.round((price * quantity + fee) * 100);

    if (paidKobo < expectedKobo) {
      return NextResponse.json({ error: 'Paid amount does not match order total' }, { status: 400 });
    }

    // --- 5. Check ticket availability to prevent overselling ---
    if (tierId) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('quantity_available, event_id')
        .eq('id', tierId)
        .single();

      // Confirm this tier actually belongs to the event in the request
      if (!tier || tier.event_id !== eventId) {
        console.error(`[verify-payment] Tier mismatch: tierId=${tierId} does not belong to eventId=${eventId}`);
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }

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
      // Legacy event — check total_tickets
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

    // --- 6. Insert verified ticket(s) ---
    const perTicketFee = fee / quantity;
    // Each row gets a unique purchase_reference so the UNIQUE constraint holds.
    // For single tickets: use the reference as-is.
    // For multi-ticket: suffix with position (e.g. ref-1, ref-2).
    const ticketsToCreate = Array.from({ length: quantity }, (_, i) => ({
      event_id: eventId,
      user_email: email,
      user_name: fullName,
      user_gender: gender || null,
      status: 'valid',
      purchase_reference: quantity > 1 ? `${reference}-${i + 1}` : reference,
      fee_amount: perTicketFee,
      total_amount_paid: price + perTicketFee,
      tier_id: tierId || null,
      tier_name: tierName || 'Standard',
    }));

    const { data, error } = await supabase
      .from('tickets')
      .insert(ticketsToCreate)
      .select();

    if (error) throw error;

    return NextResponse.json({ ticketId: data[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
