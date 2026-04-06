import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Returns the host's Paystack subaccount code for a given event
// Safe to call from client — only returns the subaccount code, nothing sensitive
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(eventId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  // Get event owner
  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .single();

  if (!event) return NextResponse.json({ subaccount_code: null });

  // Get their subaccount code
  const { data: bank } = await supabase
    .from('bank_accounts')
    .select('subaccount_code')
    .eq('user_id', event.user_id)
    .single();

  return NextResponse.json({ subaccount_code: bank?.subaccount_code || null });
}
