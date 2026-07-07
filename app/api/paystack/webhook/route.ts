import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logPaymentEvent } from '@/lib/logPaymentEvent';
import { createFallbackTicket } from '@/lib/createFallbackTicket';

// Service role — needed to bypass RLS when updating payouts/tickets
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Parsed defensively up front purely so a rejected/malformed request can
  // still be logged with whatever context is available — this never trusts
  // the payload for any action before the signature check below passes.
  let parsedForLogging: any = null;
  try { parsedForLogging = JSON.parse(rawBody); } catch { /* logged as null below */ }

  try {
    // --- 1. Verify the webhook signature from Paystack ---
    const secret = process.env.PAYSTACK_SECRET_KEY!;
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    const paystackSignature = request.headers.get('x-paystack-signature');
    if (hash !== paystackSignature) {
      // If this fires for a real, legitimate Paystack call, every fallback
      // ticket-creation path below silently never runs — this is exactly the
      // kind of failure that's been invisible until now.
      await logPaymentEvent({
        source: 'webhook', eventType: 'invalid_signature', status: 'error',
        reference: parsedForLogging?.data?.reference || null,
        email: parsedForLogging?.data?.customer?.email || null,
        message: 'Signature mismatch — request rejected before processing',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = parsedForLogging ?? JSON.parse(rawBody);

    // --- 2. Handle charge.success (belt-and-suspenders: ticket should already exist from verify-payment) ---
    if (event.event === 'charge.success') {
      const { reference, metadata, amount, customer } = event.data;

      // Breadcrumb proving Paystack actually called us for this reference —
      // answers "did the webhook even fire?" without needing platform logs.
      await logPaymentEvent({
        source: 'webhook', eventType: 'charge_success_received', status: 'success',
        reference, eventId: metadata?.event_id || null, email: customer?.email || null,
        message: 'Webhook received charge.success', metadata,
      });

      // Only creates ticket(s) if verify-payment never ran for this reference
      // (e.g. the buyer's connection dropped right after paying) — a no-op
      // (logged as 'skipped') if a ticket already exists.
      await createFallbackTicket({
        source: 'webhook',
        reference,
        metadata,
        amountKobo: amount,
        customerEmail: customer.email,
      });
    }

    // --- 3. Handle transfer outcomes ---
    if (event.event === 'transfer.success') {
      await supabase
        .from('payouts')
        .update({ status: 'paid', transfer_code: event.data.transfer_code })
        .eq('transfer_code', event.data.transfer_code);
    }

    if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      await supabase
        .from('payouts')
        .update({ status: 'failed' })
        .eq('transfer_code', event.data.transfer_code);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[webhook] Unhandled error:', err);
    await logPaymentEvent({
      source: 'webhook', eventType: 'unhandled_exception', status: 'error',
      reference: parsedForLogging?.data?.reference || null,
      email: parsedForLogging?.data?.customer?.email || null,
      message: err?.message || String(err),
    });
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
