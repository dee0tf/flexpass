import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateScanCode } from '@/lib/generateScanCode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Lets FlexPass admin generate/regenerate a door-staff access code for ANY
// event, not just ones they own — a host's own edit page does this too, but
// that route relies on RLS scoping updates to `user_id = auth.uid()`, which
// an admin acting on someone else's event doesn't satisfy. This route uses
// the service-role client instead, gated on ADMIN_EMAIL (same pattern as
// /api/admin/process-withdrawal).
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const code = generateScanCode();
    const { error } = await supabase.from('events').update({ scan_code: code }).eq('id', eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
