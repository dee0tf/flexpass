import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(str: string): string {
  return String(str).replace(/[<>"'&]/g, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, eventTitle, ticketId, amount } = body;

    // Input validation
    if (!email || !eventTitle || !ticketId || amount == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (typeof ticketId !== 'string' || ticketId.length > 100) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    const safeTitle = sanitize(eventTitle).slice(0, 200);
    const safeTicketId = sanitize(ticketId);
    const safeAmount = typeof amount === 'number' ? amount : parseFloat(amount);

    if (isNaN(safeAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: 'FlexPass <tickets@flexpasshq.com>',
      to: [email],
      subject: `Your ticket for ${safeTitle} is confirmed 🎟️`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0812;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0812;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#120D1E;border-radius:16px;overflow:hidden;border:1px solid rgba(159,103,254,0.2);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#480082,#9F67FE);padding:40px 40px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">FlexPass</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Access Granted ✅</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">You're going to <span style="color:#9F67FE;">${safeTitle}</span>!</h2>
            <p style="color:rgba(240,238,248,0.6);font-size:14px;margin:0 0 32px;">Your ticket has been confirmed and is ready to use at the door.</p>

            <!-- Ticket Card -->
            <div style="background:rgba(72,0,130,0.2);border:1px solid rgba(159,103,254,0.3);border-radius:12px;padding:24px;margin-bottom:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;border-bottom:1px dashed rgba(159,103,254,0.2);">
                    <p style="margin:0;color:rgba(240,238,248,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Ticket ID</p>
                    <p style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:800;letter-spacing:2px;">${safeTicketId}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;">
                    <p style="margin:0;color:rgba(240,238,248,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Amount Paid</p>
                    <p style="margin:4px 0 0;color:#9F67FE;font-size:22px;font-weight:800;">${safeAmount === 0 ? "Free" : `&#x20A6;${safeAmount.toLocaleString()}`}</p>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background:rgba(255,183,0,0.08);border:1px solid rgba(255,183,0,0.2);border-radius:10px;padding:16px;margin-bottom:32px;">
              <p style="margin:0;color:rgba(255,183,0,0.9);font-size:13px;font-weight:600;">📱 At the door</p>
              <p style="margin:6px 0 0;color:rgba(240,238,248,0.6);font-size:13px;line-height:1.5;">Show this email or your QR code in the FlexPass app. Keep the Ticket ID handy.</p>
            </div>

            <div style="text-align:center;">
              <a href="https://flexpasshq.com/tickets/${safeTicketId}" style="display:inline-block;background:linear-gradient(135deg,#480082,#9F67FE);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">
                View My Ticket
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(240,238,248,0.3);font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} FlexPass &middot; Lagos, Nigeria<br/>
              Questions? <a href="mailto:admin@flexpasshq.com" style="color:rgba(159,103,254,0.6);text-decoration:none;">admin@flexpasshq.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
