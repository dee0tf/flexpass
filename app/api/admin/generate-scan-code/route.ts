import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateScanCode } from '@/lib/generateScanCode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

// Lets FlexPass admin view/generate/regenerate a door-staff access code for
// ANY event, not just ones they own — the host's own edit page does this
// too, but that route checks event ownership instead, which an admin acting
// on someone else's event doesn't satisfy. scan_code lives in
// event_scan_codes, a table with RLS enabled and zero policies (see the
// move-scan-code migration) — only this service-role client can touch it.
export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const { data } = await supabase.from('event_scan_codes').select('scan_code').eq('event_id', eventId).single();
    return NextResponse.json({ code: data?.scan_code ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const code = generateScanCode();
    const { error } = await supabase
      .from('event_scan_codes')
      .upsert({ event_id: eventId, scan_code: code, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
