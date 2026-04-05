import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // --- 1. Authenticate the requesting user ---
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Minimum withdrawal ₦1,000
    if (amount < 1000) {
      return NextResponse.json({ error: 'Minimum withdrawal is ₦1,000' }, { status: 400 });
    }

    // --- 2. Check Paystack secret key is configured ---
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Payouts not configured' }, { status: 503 });
    }

    // --- 3. Get user's bank account ---
    const { data: bank, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (bankError || !bank) {
      return NextResponse.json({ error: 'No bank account saved' }, { status: 400 });
    }

    if (!bank.bank_code) {
      return NextResponse.json({ error: 'Bank code missing — please re-save your bank details' }, { status: 400 });
    }

    // --- 4. Verify user's available balance server-side ---
    const { data: myEvents } = await supabase
      .from('events').select('id').eq('user_id', user.id);
    const myEventIds = myEvents?.map((e: any) => e.id) || [];

    const { data: tickets } = await supabase
      .from('tickets')
      .select('events(price)')
      .in('event_id', myEventIds)
      .eq('status', 'valid');

    const totalRevenue = tickets?.reduce((acc: number, t: any) => acc + (t.events?.price || 0), 0) || 0;

    const { data: payouts } = await supabase
      .from('payouts')
      .select('amount, status')
      .eq('user_id', user.id)
      .neq('status', 'failed');

    const totalWithdrawn = payouts?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
    const availableBalance = Math.max(0, totalRevenue - totalWithdrawn);

    if (amount > availableBalance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // --- 5. Create or reuse Paystack transfer recipient ---
    let recipientCode = bank.recipient_code;

    if (!recipientCode) {
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
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
        return NextResponse.json({ error: 'Failed to create transfer recipient: ' + recipientData.message }, { status: 502 });
      }

      recipientCode = recipientData.data.recipient_code;

      // Store for future use
      await supabase
        .from('bank_accounts')
        .update({ recipient_code: recipientCode })
        .eq('user_id', user.id);
    }

    // --- 6. Initiate Paystack transfer ---
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100), // kobo
        recipient: recipientCode,
        reason: `FlexPass payout for ${user.email}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      return NextResponse.json({ error: 'Transfer failed: ' + transferData.message }, { status: 502 });
    }

    // --- 7. Record payout in DB ---
    const { error: payoutError } = await supabase.from('payouts').insert({
      user_id: user.id,
      amount,
      status: transferData.data.status === 'success' ? 'paid' : 'pending',
      bank_account_id: bank.id,
      transfer_code: transferData.data.transfer_code,
    });

    if (payoutError) throw payoutError;

    return NextResponse.json({
      success: true,
      status: transferData.data.status,
      transfer_code: transferData.data.transfer_code,
      message: transferData.data.status === 'success'
        ? 'Transfer sent successfully!'
        : 'Transfer initiated — funds will arrive within minutes.',
    });

  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
