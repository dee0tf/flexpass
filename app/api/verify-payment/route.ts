import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTicketEmail } from '@/lib/sendTicketEmail';
import { logPaymentEvent } from '@/lib/logPaymentEvent';
import { createTicketsAtomic } from '@/lib/createTicketsAtomic';
import { sanitizeEmail } from '@/lib/sanitizeEmail';

// Service role — create_tickets_atomic's EXECUTE grant is restricted to
// service_role only (see supabase/migrations/20260712_create_tickets_atomic.sql),
// so calling it with the anon key here always failed with "permission denied"
// and silently depended on the Paystack webhook's fallback to rescue every
// purchase. That's fine when the webhook succeeds, but leaves a buyer with
// nothing if the webhook's own fallback also fails for any reason.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Flexible group (family/table) tickets have a host-set minimum quantity —
// this is the hard ceiling regardless of that minimum, so one checkout can't
// become an unbounded bulk buy. Must match components/CheckoutModal.tsx.
const MAX_FLEXIBLE_GROUP_QUANTITY = 50;
// Per-checkout cap for ordinary (non-flexible-group) tiers — unchanged from
// the original hardcoded limit.
const MAX_STANDARD_QUANTITY = 10;

export async function POST(request: Request) {
  let reference: string | undefined;
  let eventId: string | undefined;
  let email: string | undefined;

  try {
    const body = await request.json();
    ({ reference, eventId, email } = body);
    const { fullName, gender, quantity, tierId, tierName, price, fee, referralCode } = body;

    // Strips invisible Unicode (zero-width space/joiners, BOM, soft hyphen) a
    // mobile keyboard can silently insert — it passes the \s-based regex
    // below looking completely normal, then silently fails to deliver the
    // confirmation email. Client already sanitizes, this is defense-in-depth.
    if (typeof email === 'string') email = sanitizeEmail(email);

    // --- 1. Input validation ---
    if (!reference || !eventId || !email || !fullName || !quantity || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof quantity !== 'number' || quantity < 1 || quantity > MAX_FLEXIBLE_GROUP_QUANTITY) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // --- 2. A ticket may already exist for this reference — either a real
    // replay of an old request, or (far more commonly) the Paystack webhook's
    // fallback path won a race and created it a moment before this call
    // landed. Paystack verification below is what actually proves the charge
    // succeeded, so it's safe to just hand back the existing ticket(s) here
    // rather than error out on a buyer who was charged and does have a
    // ticket — see the identical duplicate_reference handling further down.
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id')
      .or(`purchase_reference.eq.${reference},purchase_reference.like.${reference}-%`)
      .order('created_at', { ascending: true });

    if (existingTickets && existingTickets.length > 0) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'ticket_created_by_webhook_race', status: 'success',
        reference, eventId, email, message: `Ticket(s) already existed for this reference (${existingTickets.length})`,
      });
      return NextResponse.json({ ticketIds: existingTickets.map(t => t.id) });
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

    // --- 4. Look up the tier (if any) — never trust the client for group_size,
    // min_quantity, or the bulk-discount fields. group_size is how many
    // individual attendee tickets one purchased "unit" issues (1 for a normal
    // tier, e.g. 5 for a "Table of 5" bundle). min_quantity / bulk_discount_*
    // drive the flexible "family/group" ticket type: buyer picks their own
    // headcount (>= min_quantity, capped at MAX_FLEXIBLE_GROUP_QUANTITY) and
    // gets a per-ticket discount above bulk_discount_qty. Capacity itself is
    // checked atomically inside create_tickets_atomic below, under a row
    // lock, so it can't race with a concurrent purchase of the same tier.
    let groupSize = 1;
    let unitPrice = price;
    let isFlexibleGroup = false;
    if (tierId) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('price, group_size, event_id, min_quantity, bulk_discount_qty, bulk_discount_percent')
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
      isFlexibleGroup = !!tier.min_quantity;

      if (tier.min_quantity) {
        if (quantity < tier.min_quantity) {
          return NextResponse.json(
            { error: `This ticket type requires a minimum of ${tier.min_quantity} tickets.` },
            { status: 400 }
          );
        }
      } else if (quantity > MAX_STANDARD_QUANTITY) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }

      // Authoritative per-ticket price — the client-submitted `price` is
      // never trusted for a tiered purchase, since that's exactly what a
      // discount claim would otherwise let a buyer forge.
      unitPrice = tier.min_quantity && tier.bulk_discount_qty && tier.bulk_discount_percent && quantity >= tier.bulk_discount_qty
        ? Math.round(tier.price * (1 - tier.bulk_discount_percent / 100) * 100) / 100
        : tier.price;
    }

    // --- 4a. Validate that the paid amount matches what we expect ---
    // Paystack returns amount in kobo; our price is in naira. `unitPrice` is
    // already the bundle price for group tiers, so this math is unaffected
    // by group_size — `quantity` here means "groups purchased".
    const paidKobo = paystackData.data.amount;
    const expectedKobo = Math.round((unitPrice * quantity + fee) * 100);

    if (paidKobo < expectedKobo) {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'amount_mismatch', status: 'error',
        reference, eventId, email, message: `paid=${paidKobo} expected=${expectedKobo}`,
      });
      return NextResponse.json({ error: 'Paid amount does not match order total' }, { status: 400 });
    }

    // Total individual attendee tickets this purchase will issue.
    const attendeeCount = quantity * groupSize;

    // --- 5a. Anti-bulk-buying: max 6 individual tickets per email per event —
    // raised to MAX_FLEXIBLE_GROUP_QUANTITY for flexible group/family tiers,
    // since one person buying 10+ tickets there is the expected use case,
    // not abuse.
    const bulkCap = isFlexibleGroup ? MAX_FLEXIBLE_GROUP_QUANTITY : 6;
    const { count: alreadyOwned } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('user_email', email.toLowerCase())
      .in('status', ['valid', 'scanned']);

    if ((alreadyOwned || 0) + attendeeCount > bulkCap) {
      const remaining = Math.max(0, bulkCap - (alreadyOwned || 0));
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'anti_bulk_rejected', status: 'error',
        reference, eventId, email, message: `alreadyOwned=${alreadyOwned} attendeeCount=${attendeeCount}`,
      });
      return NextResponse.json(
        { error: remaining <= 0
            ? `You have already reached the maximum tickets allowed for this event (${bulkCap} per person).`
            : `You can only buy ${remaining} more ticket${remaining === 1 ? '' : 's'} for this event.` },
        { status: 409 }
      );
    }

    // --- 6. Insert verified ticket(s) atomically — one row per individual
    // attendee. Capacity is checked and enforced inside create_tickets_atomic
    // under a row lock on the tier (or event, for legacy events), so two
    // simultaneous purchases for the last slot can't both succeed.
    const perTicketFee = fee / attendeeCount;
    const perTicketPrice = unitPrice / groupSize;
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

    // Record what Paystack actually deducted for this charge — separate
    // from the 5% we add at checkout, since that markup doesn't fully cover
    // Paystack's real per-transaction cost. Needed to compute FlexPass's
    // true net revenue rather than just the gross fee charged to buyers.
    if (typeof paystackData.data.fees === 'number') {
      await logPaymentEvent({
        source: 'verify-payment', eventType: 'paystack_fee_recorded', status: 'success',
        reference, eventId, email, message: 'Recorded Paystack processing fee for this charge',
        metadata: { feesNaira: paystackData.data.fees / 100, amountNaira: paidKobo / 100 },
      });
    }

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
