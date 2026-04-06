import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Creates or updates a Paystack subaccount for the authenticated user
export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  // Authenticate user
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get their saved bank details
  const { data: bank } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!bank) return NextResponse.json({ error: 'No bank details saved' }, { status: 400 });
  if (!bank.bank_code || !bank.account_number || !bank.account_name) {
    return NextResponse.json({ error: 'Incomplete bank details' }, { status: 400 });
  }

  // If subaccount already exists, return it
  if (bank.subaccount_code) {
    return NextResponse.json({ subaccount_code: bank.subaccount_code });
  }

  // Create subaccount on Paystack
  // percentage_charge is YOUR platform fee (5%) — the rest goes to the host
  const res = await fetch('https://api.paystack.co/subaccount', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_name: bank.account_name,
      settlement_bank: bank.bank_code,
      account_number: bank.account_number,
      percentage_charge: 5, // FlexPass keeps 5%, host gets 95%
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.status) {
    return NextResponse.json(
      { error: data.message || 'Failed to create subaccount' },
      { status: 502 }
    );
  }

  const subaccount_code = data.data.subaccount_code;

  // Save to DB
  await supabase
    .from('bank_accounts')
    .update({ subaccount_code })
    .eq('user_id', user.id);

  return NextResponse.json({ subaccount_code });
}
