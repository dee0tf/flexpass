import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'flexpasshome@gmail.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // 1. Verify caller is the admin
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { payout_id, action } = await request.json();

    if (!payout_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // 2. Get the payout record
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .select('*, bank_accounts(*)')
      .eq('id', payout_id)
      .eq('status', 'pending')
      .single();

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found or already processed' }, { status: 404 });
    }

    // 3. Reject — just update status
    if (action === 'reject') {
      await supabase.from('payouts').update({ status: 'rejected' }).eq('id', payout_id);
      return NextResponse.json({ success: true, message: 'Withdrawal rejected.' });
    }

    // 4. Approve — fire the actual Paystack transfer
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 });

    const bank = payout.bank_accounts;
    if (!bank) return NextResponse.json({ error: 'No bank account on record' }, { status: 400 });

    // Create or reuse transfer recipient
    let recipientCode = bank.recipient_code;

    if (!recipientCode) {
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nuban',
          name: bank.account_name,
          account_number: bank.account_number,
          bank_code: bank.bank_code,
          currency: 'NGN',
        }),
      });
      const recipientData = await recipientRes.json();
      if (!recipientData.status) {
        return NextResponse.json({ error: 'Failed to create recipient: ' + recipientData.message }, { status: 502 });
      }
      recipientCode = recipientData.data.recipient_code;
      await supabase.from('bank_accounts').update({ recipient_code: recipientCode }).eq('id', bank.id);
    }

    // Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payout.amount * 100), // kobo
        recipient: recipientCode,
        reason: `FlexPass payout #${payout_id}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      return NextResponse.json({ error: 'Transfer failed: ' + transferData.message }, { status: 502 });
    }

    // Update payout record
    await supabase.from('payouts').update({
      status: transferData.data.status === 'success' ? 'paid' : 'processing',
      transfer_code: transferData.data.transfer_code,
    }).eq('id', payout_id);

    return NextResponse.json({
      success: true,
      message: transferData.data.status === 'success'
        ? 'Transfer sent successfully!'
        : 'Transfer initiated — funds will arrive shortly.',
      transfer_code: transferData.data.transfer_code,
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
