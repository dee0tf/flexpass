import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { ticketId, eventId } = await request.json();

    if (!ticketId || !eventId) {
      return NextResponse.json({ error: 'Missing ticketId or eventId' }, { status: 400 });
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ticketId) || !uuidRegex.test(eventId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Authenticate the scanning user (event organiser)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confirm this user owns the event
    const { data: event } = await supabase
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
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, status, user_name, user_email, tier_name, checked_in_at, event_id')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      return NextResponse.json({ valid: false, reason: 'Ticket not found' }, { status: 404 });
    }

    // Ticket must belong to this event
    if (ticket.event_id !== eventId) {
      return NextResponse.json({ valid: false, reason: 'Ticket is for a different event' }, { status: 400 });
    }

    // Ticket must be valid (not cancelled/refunded)
    if (ticket.status !== 'valid') {
      return NextResponse.json({ valid: false, reason: `Ticket status: ${ticket.status}` }, { status: 400 });
    }

    // Already checked in?
    if (ticket.checked_in_at) {
      return NextResponse.json({
        valid: false,
        reason: 'Already checked in',
        checkedInAt: ticket.checked_in_at,
        holder: ticket.user_name,
      }, { status: 409 });
    }

    // Mark as checked in
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ checked_in_at: now })
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

// GET — just look up a ticket without checking it in (preview)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('t');

  if (!ticketId) {
    return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(ticketId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const { data: ticket } = await supabase
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
