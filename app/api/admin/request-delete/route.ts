import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'flexpasshome@gmail.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { eventId, reason } = await request.json();

    if (!eventId || !reason?.trim()) {
      return NextResponse.json({ error: 'Event ID and reason are required' }, { status: 400 });
    }

    // Verify the requester owns this event
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, user_id')
      .eq('id', eventId)
      .single();

    if (eventErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Insert delete request
    const { error: insertErr } = await supabase.from('delete_requests').insert({
      event_id: eventId,
      user_id: user.id,
      event_title: event.title,
      reason: reason.trim(),
      status: 'pending',
    });

    if (insertErr) {
      console.error('[request-delete] Insert error:', insertErr);
      throw insertErr;
    }

    // Notify admin via email
    await resend.emails.send({
      from: 'FlexPass <noreply@flexpasshq.com>',
      to: [ADMIN_EMAIL],
      subject: `Delete Request: ${event.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#480082;">New Event Deletion Request</h2>
          <p><strong>Event:</strong> ${event.title}</p>
          <p><strong>Event ID:</strong> ${eventId}</p>
          <p><strong>Requested by:</strong> ${user.email}</p>
          <p><strong>Reason:</strong></p>
          <blockquote style="border-left:3px solid #480082;padding-left:12px;color:#555;">${reason.trim()}</blockquote>
          <p style="margin-top:24px;">
            <a href="https://flexpasshq.com/admin" style="background:#480082;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Review in Admin Panel
            </a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:24px;">FlexPass Admin Notifications</p>
        </div>
      `,
    }).catch(() => {}); // Email failure is non-fatal

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[request-delete] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
