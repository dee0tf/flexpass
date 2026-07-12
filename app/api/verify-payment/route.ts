import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from '@/lib/sendTicketEmail';
import { logPaymentEvent } from '@/lib/logPaymentEvent';
import { createTicketsAtomic } from '@/lib/createTicketsAtomic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  let reference: string | undefined;
  let eventId: string | undefined;
  let email: string | undefined;

  try {
    const body = await request.json();
    ({ reference, eventId, email } = body);
    const { fullName, gender, quantity, tierId, tierName, price, fee, referralCode } = body;

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
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'replay_blocked', status: 'skipped',
        reference, eventId, email, message: 'Reference already has a ticket',
      });
      return NextResponse.json({ error: 'Payment reference already used' }, { status: 409 });
    }

    // --- 2a. Reject if ticket sales have closed for this event ---
    const { data: eventRow } = await supabase
      .from('events')
      .select('title, sales_end_date, total_tickets')
      .eq('id', eventId)
      .single();

    if (eventRow?.sales_end_date && new Date(eventRow.sales_end_date) < new Date()) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'sales_closed', status: 'error',
        reference, eventId, email, message: `sales_end_date=${eventRow.sales_end_date}`,
      });
      return NextResponse.json({ error: 'Ticket sales have closed for this event' }, { status: 409 });
    }

    // --- 3. Verify payment with Paystack server-side ---
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'config_error', status: 'error',
        reference, eventId, email, message: 'PAYSTACK_SECRET_KEY missing',
      });
      return NextResponse.json({ error: 'Payment verification unavailable' }, { status: 503 });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    if (!paystackRes.ok) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'paystack_unreachable', status: 'error',
        reference, eventId, email, message: `Paystack verify returned HTTP ${paystackRes.status}`,
      });
      return NextResponse.json({ error: 'Failed to reach Paystack' }, { status: 502 });
    }

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'payment_not_successful', status: 'error',
        reference, eventId, email, message: `Paystack status: ${paystackData.data?.status}`,
      });
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // --- 4. Validate that the paid amount matches what we expect ---
    // Paystack returns amount in kobo; our price is in naira. `price` is
    // already the bundle price for group tiers, so this math is unaffected
    // by group_size — `quantity` here means "groups purchased".
    const paidKobo = paystackData.data.amount;
    const expectedKobo = Math.round((price * quantity + fee) * 100);

    if (paidKobo < expectedKobo) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'amount_mismatch', status: 'error',
        reference, eventId, email, message: `paid=${paidKobo} expected=${expectedKobo}`,
      });
      return NextResponse.json({ error: 'Paid amount does not match order total' }, { status: 400 });
    }

    // --- 5. Look up the tier (if any) to get group_size — never trust the
    // client for it. group_size is how many individual attendee tickets one
    // purchased "unit" issues (1 for a normal tier, e.g. 5 for a "Table of 5"
    // bundle). Capacity itself is checked atomically inside
    // create_tickets_atomic below, under a row lock, so it can't race with a
    // concurrent purchase of the same tier.
    let groupSize = 1;
    if (tierId) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('group_size, event_id')
        .eq('id', tierId)
        .single();

      // Confirm this tier actually belongs to the event in the request
      if (!tier || tier.event_id !== eventId) {
        console.error(`[verify-payment] Tier mismatch: tierId=${tierId} does not belong to eventId=${eventId}`);
        await logPaymentEvent({
          source: 'verify-payment', eventType: 'tier_mismatch', status: 'error',
          reference, eventId, email, message: `tierId=${tierId} does not belong to eventId=${eventId}`,
        });
        return NextResponse.json({ error: 'Invalid ticket tier for this event' }, { status: 400 });
      }
      groupSize = tier.group_size || 1;
    }

    // Total individual attendee tickets this purchase will issue.
    const attendeeCount = quantity * groupSize;

    // --- 5a. Anti-bulk-buying: max 6 individual tickets per email per event ---
    const { count: alreadyOwned } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_email', email.toLowerCase())
      .in('status', ['valid', 'scanned']);

    if ((alreadyOwned || 0) + attendeeCount > 6) {
      const remaining = Math.max(0, 6 - (alreadyOwned || 0));
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'anti_bulk_rejected', status: 'error',
        reference, eventId, email, message: `alreadyOwned=${alreadyOwned} attendeeCount=${attendeeCount}`,
      });
      return NextResponse.json(
        { error: remaining <= 0
            ? 'You have already reached the maximum tickets allowed for this event (6 per person).'
            : `You can only buy ${remaining} more ticket${remaining === 1 ? '' : 's'} for this event.` },
        { status: 409 }
      );
    }

    // --- 6. Insert verified ticket(s) atomically — one row per individual
    // attendee. Capacity is checked and enforced inside create_tickets_atomic
    // under a row lock on the tier (or event, for legacy events), so two
    // simultaneous purchases for the last slot can't both succeed.
    const perTicketFee = fee / attendeeCount;
    const perTicketPrice = price / groupSize;
    // Each row gets a unique purchase_reference so the UNIQUE constraint holds.
    // For a single ticket: use the reference as-is.
    // For multi-ticket/group purchases: suffix with position (e.g. ref-1, ref-2).
    const ticketsToCreate = Array.from({ length: attendeeCount }, (_, i) => ({
      event_id: eventId!,
      user_email: email!,
      user_name: fullName,
      user_gender: gender || null,
      status: 'valid',
      purchase_reference: attendeeCount > 1 ? `${reference}-${i + 1}` : reference!,
      fee_amount: perTicketFee,
      total_amount_paid: perTicketPrice + perTicketFee,
      tier_id: tierId || null,
      tier_name: tierName || 'Standard',
      referral_code: referralCode || null,
    }));

    const result = await createTicketsAtomic(supabase, {
      tierId: tierId || null,
      eventId,
      quantity,
      tickets: ticketsToCreate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[];

    if (result.outcome === 'duplicate_reference') {
      // A duplicate purchase_reference means the webhook's fallback path won
      // the race and already created the ticket(s) a moment before we tried
      // to insert our own — not a failure, just two safety nets firing for
      // the same purchase. Return what's already there instead of erroring
      // out to a customer who actually does have a valid ticket.
      const { data: existing } = await supabase
        .from('tickets')
        .select('id')
        .or(`purchase_reference.eq.${reference},purchase_reference.like.${reference}-%`)
        .order('created_at', { ascending: true });

      if (existing && existing.length > 0) {
        await logPaymentEvent({
          source: 'verify-payment', eventType: 'ticket_created_by_webhook_race', status: 'success',
          reference, eventId, email,
          message: `Webhook fallback already created ${existing.length} ticket(s) for this reference`,
        });
        return NextResponse.json({ ticketIds: existing.map(t => t.id) });
      }

      await logPaymentEvent({
        source: 'verify-payment', eventType: 'ticket_insert_failed', status: 'error',
        reference, eventId, email, message: 'Duplicate purchase reference with no matching ticket found',
        metadata: { attendeeCount, tierId: tierId || null },
      });
      throw new Error('Duplicate purchase reference with no matching ticket found');
    } else if (result.outcome === 'sold_out' || result.outcome === 'tier_not_found') {
      const remaining = result.outcome === 'sold_out' ? result.remaining : 0;
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'oversold', status: 'error',
        reference, eventId, email,
        message: result.outcome === 'sold_out'
          ? `tierId=${tierId || 'legacy'} remaining=${remaining} requested=${quantity}`
          : `tierId=${tierId} not found`,
      });
      return NextResponse.json(
        { error: remaining <= 0 ? 'This ticket tier is sold out' : `Only ${remaining} left` },
        { status: 409 }
      );
    } else if (result.outcome === 'error') {
      // This is the critical failure mode this log exists to catch: Paystack
      // already confirmed the charge succeeded, but we failed to record the
      // ticket(s) — the customer is now charged with nothing to show for it.
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'ticket_insert_failed', status: 'error',
        reference, eventId, email, message: result.message,
        metadata: { attendeeCount, tierId: tierId || null },
      });
      throw new Error(result.message);
    } else {
      data = result.tickets;
    }

    await logPaymentEvent({
      source: 'verify-payment', eventType: 'ticket_created', status: 'success',
      reference, eventId, email, message: `Created ${data.length} ticket(s)`,
      metadata: { ticketIds: data.map(t => t.id) },
    });

    // --- 8. Send confirmation email server-side. Must be awaited before
    // returning — a serverless function can be frozen/torn down right after
    // its response is sent, so a fire-and-forget send here would be just as
    // unreliable as the client-side version this replaces.
    try {
      const { error: emailError } = await sendTicketEmail({
        email,
        eventTitle: eventRow?.title || 'your event',
        ticketIds: data.map(t => t.id),
        amount: price * quantity + fee,
      });
      if (emailError) {
        console.error('[verify-payment] Ticket email failed:', emailError);
        await logPaymentEvent({
          source: 'verify-payment', eventType: 'email_failed', status: 'error',
          reference, eventId, email, message: JSON.stringify(emailError),
        });
      }
    } catch (emailErr) {
      console.error('[verify-payment] Ticket email threw:', emailErr);
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'email_failed', status: 'error',
        reference, eventId, email, message: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({ ticketIds: data.map(t => t.id) });
  } catch (err: any) {
    console.error('[verify-payment] Unhandled error:', err);
    await logPaymentEvent({
      source: 'verify-payment', eventType: 'unhandled_exception', status: 'error',
      reference, eventId, email, message: err?.message || String(err),
    });
    return NextResponse.json({ error: 'Internal server error: ' + (err?.message || 'unknown') }, { status: 500 });
  }
}
