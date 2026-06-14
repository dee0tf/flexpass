import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Anon client — only used for token verification
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Service-role client — bypasses RLS so checked_in_at is always written
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const { ticketId, eventId } = await request.json();

    if (!ticketId || !eventId) {
      return NextResponse.json({ error: 'Missing ticketId or eventId' }, { status: 400 });
    }

    if (!UUID_RE.test(ticketId) || !UUID_RE.test(eventId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Verify the scanner is an authenticated user
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm this user owns the event (via service-role client)
    const { data: event } = await db
      .from('events')
      .select('id, title, user_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.user_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this event' }, { status: 403 });
    }

    // Fetch the ticket
    const { data: ticket } = await db
      .from('tickets')
      .select('id, status, user_name, user_email, tier_name, checked_in_at, event_id')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      return NextResponse.json({ valid: false, reason: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.event_id !== eventId) {
      return NextResponse.json({ valid: false, reason: 'Ticket is for a different event' }, { status: 400 });
    }

    // Check re-entry first — catches both status='scanned' and any lingering checked_in_at
    if (ticket.status === 'scanned' || ticket.checked_in_at) {
      return NextResponse.json({
        valid: false,
        reason: 'Already checked in',
        checkedInAt: ticket.checked_in_at,
        holder: ticket.user_name,
        email: ticket.user_email,
        tier: ticket.tier_name || 'Standard',
      }, { status: 409 });
    }

    if (ticket.status !== 'valid') {
      return NextResponse.json({ valid: false, reason: `Ticket is ${ticket.status} — cannot admit` }, { status: 400 });
    }

    // Mark as checked in (service-role bypasses RLS — always succeeds)
    const now = new Date().toISOString();
    const { error: updateError } = await db
      .from('tickets')
      .update({ checked_in_at: now, status: 'scanned' })
      .eq('id', ticketId);

    if (updateError) throw updateError;

    return NextResponse.json({
      valid: true,
      holder: ticket.user_name,
      email: ticket.user_email,
      tier: ticket.tier_name || 'Standard',
      checkedInAt: now,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — look up a ticket without checking it in (preview / deep-link from QR URL)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('t');

  if (!ticketId) {
    return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400 });
  }

  if (!UUID_RE.test(ticketId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const { data: ticket } = await db
    .from('tickets')
    .select('id, status, user_name, tier_name, checked_in_at, event_id, events(title, date, location)')
    .eq('id', ticketId)
    .single();

  if (!ticket) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    status: ticket.status,
    holder: ticket.user_name,
    tier: ticket.tier_name || 'Standard',
    checkedIn: !!ticket.checked_in_at,
    checkedInAt: ticket.checked_in_at,
    event: (ticket as any).events,
  });
}
