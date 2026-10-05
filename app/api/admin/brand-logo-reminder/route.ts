import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

const PAGE = 1000; // Supabase caps a single select at 1000 rows
const BATCH = 100; // Resend batch.send limit per call

const SUBJECT = 'Add your logo — get featured on FlexPass';

function emailHtml(name: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F9F8FF;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="background:linear-gradient(135deg,#480082,#9F67FE);border-radius:16px 16px 0 0;padding:28px 28px 24px;color:#fff;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FFB700;font-weight:700;">New on FlexPass</p>
    <h1 style="margin:0;font-size:24px;line-height:1.25;">Show off your brand on our homepage</h1>
  </div>
  <div style="background:#fff;border:1px solid #eDdedd;border-top:none;border-radius:0 0 16px 16px;padding:28px;color:#0E0D0D;">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${name},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
      We've added a <strong>Trusted by</strong> section to the FlexPass homepage, showcasing the organizers who host with us.
      Upload your brand logo and it can appear there for everyone browsing events.
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
      It's optional and takes about 30 seconds. You can choose whether to show it on the homepage.
    </p>
    <a href="https://flexpasshq.com/dashboard/settings#brand" style="display:inline-block;background:#FFB700;color:#0E0D0D;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">
      Upload my logo
    </a>
    <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#0E0D0D99;">
      Tip: a transparent PNG looks best. Find it anytime under Dashboard &rarr; Settings &rarr; Brand Logo.
    </p>
  </div>
  <p style="text-align:center;font-size:12px;color:#0E0D0D66;margin:18px 0 0;">
    You're receiving this because you host events on <a href="https://flexpasshq.com" style="color:#480082;">FlexPass</a>.
  </p>
</div>
</body></html>`;
}

// Hosts = anyone who has created an event, minus those who already saved a logo.
async function hostsWithoutLogo() {
  const hostIds = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('events').select('user_id').range(from, from + PAGE - 1);
    if (error) throw error;
    data.forEach(e => e.user_id && hostIds.add(e.user_id));
    if (data.length < PAGE) break;
  }

  const { data: brands, error: brandErr } = await supabase
    .from('host_brands').select('user_id').not('logo_url', 'is', null);
  if (brandErr) throw brandErr;
  brands.forEach(b => hostIds.delete(b.user_id));

  const recipients: { email: string; name: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    for (const u of data.users) {
      if (hostIds.has(u.id) && u.email) {
        const meta = u.user_metadata || {};
        recipients.push({ email: u.email, name: meta.organizer_name || meta.full_name || 'there' });
      }
    }
    if (data.users.length < PAGE) break;
  }
  return recipients;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Admin-only. mode:
 *  - "preview": how many hosts would get the email (sends nothing)
 *  - "test":    sends one copy to the admin's own inbox
 *  - "send":    emails every host who hasn't uploaded a logo yet
 */
export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { mode } = await request.json();
    if (!['preview', 'test', 'send'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    if (mode === 'test') {
      const { error } = await resend.emails.send({
        from: 'FlexPass <hello@flexpasshq.com>',
        to: [user.email!],
        subject: `[TEST] ${SUBJECT}`,
        html: emailHtml('there'),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ sent: 1, to: user.email });
    }

    const recipients = await hostsWithoutLogo();
    if (mode === 'preview') return NextResponse.json({ count: recipients.length });

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const chunk = recipients.slice(i, i + BATCH);
      const { error } = await resend.batch.send(chunk.map(r => ({
        from: 'FlexPass <hello@flexpasshq.com>',
        to: [r.email],
        subject: SUBJECT,
        html: emailHtml(escapeHtml(r.name)),
      })));
      if (error) failed += chunk.length;
      else sent += chunk.length;
    }
    return NextResponse.json({ sent, failed, total: recipients.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
