import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendTicketEmail } from '@/lib/sendTicketEmail';

// Service role — needed to bypass RLS when updating payouts/tickets
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
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
      const quantity = metadata?.quantity && Number(metadata.quantity) > 0 ? Number(metadata.quantity) : 1;

      // verify-payment stores a bare reference for a single ticket, or
      // `${reference}-1`, `${reference}-2`, ... for multi-ticket purchases.
      // Checking both catches either case without needing quantity upfront.
      const { data: existingTickets } = await supabase
        .from('tickets')
        .select('id')
        .in('purchase_reference', [reference, `${reference}-1`]);

      // Only create ticket(s) if verify-payment never ran for this reference
      // (e.g. the buyer's connection dropped right after paying).
      if ((!existingTickets || existingTickets.length === 0) && metadata?.event_id) {
        const perTicketAmount = (amount / 100) / quantity;
        const ticketsToCreate = Array.from({ length: quantity }, (_, i) => ({
          event_id: metadata.event_id,
          user_email: customer.email,
          user_name: metadata.full_name || customer.email,
          user_gender: metadata.gender || null,
          status: 'valid',
          purchase_reference: quantity > 1 ? `${reference}-${i + 1}` : reference,
          total_amount_paid: perTicketAmount,
          tier_id: metadata.tier_id || null,
          tier_name: metadata.tier_name || 'Standard',
          referral_code: metadata.referral_code || null,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('tickets')
          .insert(ticketsToCreate)
          .select();

        if (insertError) {
          console.error('[webhook] Fallback ticket insert failed:', insertError);
        } else if (inserted?.length) {
          console.warn(`[webhook] Created ${inserted.length} ticket(s) via fallback for reference=${reference} — verify-payment never completed for this purchase.`);
          const { data: eventRow } = await supabase.from('events').select('title').eq('id', metadata.event_id).single();
          try {
            const { error: emailError } = await sendTicketEmail({
              email: customer.email,
              eventTitle: eventRow?.title || 'your event',
              ticketIds: inserted.map(t => t.id),
              amount: amount / 100,
            });
            if (emailError) console.error('[webhook] Fallback ticket email failed:', emailError);
          } catch (emailErr) {
            console.error('[webhook] Fallback ticket email threw:', emailErr);
          }
        }
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
