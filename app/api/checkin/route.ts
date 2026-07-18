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
// The reference code printed under a ticket's QR (TicketQR.tsx) is the
// ticket ID truncated to its first 3 groups — not a full ID. Accept it too
// so staff can type it in by hand when a QR won't scan.
const ID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}$/i;

export async function POST(request: Request) {
  try {
    const { ticketId, eventId } = await request.json();

    if (!ticketId || !eventId) {
      return NextResponse.json({ code: 'unrecognized', error: 'Unrecognized barcode — no ticket code detected' }, { status: 400 });
    }

    const isFullId = UUID_RE.test(ticketId);
    const isPrefixId = !isFullId && ID_PREFIX_RE.test(ticketId);
    if ((!isFullId && !isPrefixId) || !UUID_RE.test(eventId)) {
      return NextResponse.json({ code: 'unrecognized', error: 'Unrecognized barcode — this is not a valid FlexPass ticket code' }, { status: 400 });
    }

    // Verify the scanner is an authenticated user
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ code: 'session_expired', error: 'Your scanner session has expired — sign in again to keep scanning' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ code: 'session_expired', error: 'Your scanner session has expired — sign in again to keep scanning' }, { status: 401 });
    }

    // Confirm this user owns the event (via service-role client)
    const { data: event } = await db
      .from('events')
      .select('id, title, user_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ code: 'event_not_found', error: 'Event not found' }, { status: 404 });
    }
    // Either the event's own host, or a FlexPass admin scanning on a host's
    // behalf (e.g. running the door for an event FlexPass staff is covering).
    const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
    if (event.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ code: 'not_your_event', error: "You don't have access to scan tickets for this event" }, { status: 403 });
    }

    // Fetch the ticket — exact match on a full ID, prefix match on the
    // shortened reference code shown under the QR (see ID_PREFIX_RE above).
    // Postgres' uuid columns don't support pattern matching, so the prefix
    // lookup is scoped to this event and matched in memory instead.
    const ticketFields = 'id, status, user_name, user_email, tier_name, checked_in_at, event_id, is_giveaway';
    let ticket: { id: string; status: string; user_name: string; user_email: string; tier_name: string | null; checked_in_at: string | null; event_id: string; is_giveaway: boolean } | undefined;
    if (isFullId) {
      const { data } = await db.from('tickets').select(ticketFields).eq('id', ticketId.toLowerCase());
      ticket = data?.[0];
    } else {
      const prefix = ticketId.toLowerCase();
      const { data } = await db.from('tickets').select(ticketFields).eq('event_id', eventId);
      ticket = data?.find(t => t.id.toLowerCase().startsWith(prefix));
    }

    if (!ticket) {
      return NextResponse.json({ valid: false, code: 'not_found', reason: "Ticket doesn't exist — unrecognized barcode" }, { status: 404 });
    }

    if (ticket.event_id !== eventId) {
      return NextResponse.json({ valid: false, code: 'wrong_event', reason: 'This ticket is for a different event' }, { status: 400 });
    }

    // Check re-entry first — catches both status='scanned' and any lingering checked_in_at
    if (ticket.status === 'scanned' || ticket.checked_in_at) {
      return NextResponse.json({
        valid: false,
        code: 'already_checked_in',
        reason: 'Already scanned — this ticket was used before',
        checkedInAt: ticket.checked_in_at,
        holder: ticket.user_name,
        email: ticket.user_email,
        tier: ticket.tier_name || 'Standard',
        giveaway: ticket.is_giveaway,
      }, { status: 409 });
    }

    if (ticket.status !== 'valid') {
      return NextResponse.json({ valid: false, code: 'not_valid', reason: `Ticket is ${ticket.status} — cannot admit` }, { status: 400 });
    }

    // Mark as checked in (service-role bypasses RLS — always succeeds)
    const now = new Date().toISOString();
    const { error: updateError } = await db
      .from('tickets')
      .update({ checked_in_at: now, status: 'scanned' })
      .eq('id', ticket.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      valid: true,
      holder: ticket.user_name,
      email: ticket.user_email,
      tier: ticket.tier_name || 'Standard',
      checkedInAt: now,
      giveaway: ticket.is_giveaway,
    });
  } catch {
    return NextResponse.json({ code: 'server_error', error: "Couldn't reach the server — check connection and try again" }, { status: 500 });
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
