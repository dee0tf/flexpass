import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // --- 1. Verify the webhook signature from Paystack ---
    const secret = process.env.PAYSTACK_SECRET_KEY!;
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    const paystackSignature = request.headers.get('x-paystack-signature');
    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // --- 2. Handle charge.success (belt-and-suspenders: ticket should already exist from verify-payment) ---
    if (event.event === 'charge.success') {
      const { reference, metadata, amount, customer } = event.data;

      // Only create ticket if it wasn't already created by verify-payment
      const { data: existing } = await supabase
        .from('tickets')
        .select('id')
        .eq('purchase_reference', reference)
        .maybeSingle();

      if (!existing && metadata?.event_id) {
        await supabase.from('tickets').insert({
          event_id: metadata.event_id,
          user_email: customer.email,
          user_name: metadata.full_name || customer.email,
          status: 'valid',
          purchase_reference: reference,
          total_amount_paid: amount / 100,
          tier_id: metadata.tier_id || null,
          tier_name: metadata.tier_name || 'Standard',
        });
      }
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
  } catch {
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
