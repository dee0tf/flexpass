import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { constantTimeEqual } from '@/lib/constantTimeEqual';

// Service-role client. scan_code lives in event_scan_codes, a table with
// RLS enabled and zero policies — only the service role can read it at all
// (see the move-scan-code migration for why it isn't a column on `events`,
// which the anon key can already read for the public event page).
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verifies a door-staff access code against the event it's scoped to. This
// is deliberately a low-friction gate (a shared per-event code, not a
// per-person account) — see the scan_code migration for why. It grants
// nothing beyond what /api/checkin does with it: scanning tickets for this
// one event only.
export async function POST(request: Request) {
  try {
    const { eventId, code } = await request.json();

    if (!eventId || !UUID_RE.test(eventId) || !code || typeof code !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
    }

    const [{ data: event }, { data: scanCodeRow }] = await Promise.all([
      db.from('events').select('id, title, date').eq('id', eventId).single(),
      db.from('event_scan_codes').select('scan_code').eq('event_id', eventId).single(),
    ]);

    if (!event || !scanCodeRow?.scan_code || !constantTimeEqual(scanCodeRow.scan_code, code)) {
      return NextResponse.json({ ok: false, error: 'Incorrect access code' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, title: event.title, date: event.date });
  } catch {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
