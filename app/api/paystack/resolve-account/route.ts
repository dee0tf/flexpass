import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const account_number = searchParams.get('account_number');
  const bank_code = searchParams.get('bank_code');

  if (!account_number || !bank_code) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Validate account number format
  if (!/^\d{10}$/.test(account_number)) {
    return NextResponse.json({ error: 'Invalid account number format' }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    const data = await res.json();

    if (!res.ok || !data.status) {
      return NextResponse.json({ error: data.message || 'Could not resolve account' }, { status: 400 });
    }

    // Only return the account name — never expose full Paystack response to client
    return NextResponse.json({ account_name: data.data.account_name });
  } catch {
    return NextResponse.json({ error: 'Verification service unavailable' }, { status: 502 });
  }
}
