import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateScanCode } from '@/lib/generateScanCode';

// Anon client — only used for token verification, same pattern as /api/checkin.
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Service-role client — event_scan_codes has RLS enabled with zero
// policies (see the move-scan-code migration), so only this can touch it.
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireOwner(request: Request, eventId: string) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return false;
  const { data: event } = await db.from('events').select('user_id').eq('id', eventId).single();
  return !!event && event.user_id === user.id;
}

// Host-facing counterpart to /api/admin/generate-scan-code — same
// event_scan_codes table, but gated on "is this the event's own host"
// instead of ADMIN_EMAIL. Was previously a direct client-side update
// against `events` relying on RLS (user_id = auth.uid()); moved server-side
// once scan_code moved off `events` (which the anon key can read for the
// public event page) onto a table nothing but the service role can touch.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    if (!(await requireOwner(request, eventId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data } = await db.from('event_scan_codes').select('scan_code').eq('event_id', eventId).single();
    return NextResponse.json({ code: data?.scan_code ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    if (!(await requireOwner(request, eventId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const code = generateScanCode();
    const { error } = await db
      .from('event_scan_codes')
      .upsert({ event_id: eventId, scan_code: code, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
