import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { payout_id, action } = await request.json();

    if (!payout_id || !['approve', 'reject', 'mark_paid'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // mark_paid: processing → paid
    if (action === 'mark_paid') {
      const { error } = await supabase
        .from('payouts')
        .update({ status: 'paid' })
        .eq('id', payout_id)
        .eq('status', 'processing');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: 'Payout marked as paid.' });
    }

    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .select('id, status')
      .eq('id', payout_id)
      .eq('status', 'pending')
      .single();

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found or already processed' }, { status: 404 });
    }

    if (action === 'reject') {
      await supabase.from('payouts').update({ status: 'rejected' }).eq('id', payout_id);
      return NextResponse.json({ success: true, message: 'Withdrawal rejected.' });
    }

    // Approve — mark as processing (admin transfers manually, then marks paid)
    await supabase.from('payouts').update({ status: 'processing' }).eq('id', payout_id);
    return NextResponse.json({ success: true, message: 'Marked as processing. Complete the bank transfer and click Mark Paid when done.' });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
