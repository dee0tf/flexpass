import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function sanitize(str: string): string {
  return String(str).replace(/[<>"'&]/g, '');
}

export async function sendTicketEmail({
  email,
  eventTitle,
  ticketIds,
  amount,
}: {
  email: string;
  eventTitle: string;
  ticketIds: string[];
  amount: number;
}) {
  const safeTitle = sanitize(eventTitle).slice(0, 200);
  const safeTicketIds = ticketIds.map(sanitize);
  const multiple = safeTicketIds.length > 1;

  const ticketCards = safeTicketIds.map((id, i) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(72,0,130,0.2);border:1px solid rgba(159,103,254,0.3);border-radius:12px;padding:24px;${i < safeTicketIds.length - 1 ? "margin-bottom:16px;" : "margin-bottom:32px;"}">
                <tr>
                  <td>
                    <p style="margin:0;color:rgba(240,238,248,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">
                      ${multiple ? `Ticket ${i + 1} of ${safeTicketIds.length}` : "Ticket ID"}
                    </p>
                    <p style="margin:4px 0 12px;color:#fff;font-size:20px;font-weight:800;letter-spacing:2px;">${id}</p>
                    <a href="https://flexpasshq.com/tickets/${id}" style="display:inline-block;background:linear-gradient(135deg,#480082,#9F67FE);color:#fff;text-decoration:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:13px;">
                      View Ticket & QR Code
                    </a>
                  </td>
                </tr>
              </table>`).join('');

  return resend.emails.send({
    from: 'FlexPass <tickets@flexpasshq.com>',
    to: [email],
    subject: multiple
      ? `Your ${safeTicketIds.length} tickets for ${safeTitle} are confirmed 🎟️`
      : `Your ticket for ${safeTitle} is confirmed 🎟️`,
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
            <p style="color:rgba(240,238,248,0.6);font-size:14px;margin:0 0 32px;">
              ${multiple
                ? `Your ${safeTicketIds.length} tickets have been confirmed and are ready to use at the door. Each ticket below has its own QR code — share them with the people joining you.`
                : "Your ticket has been confirmed and is ready to use at the door."}
            </p>

            <!-- Ticket Card(s) -->
            ${ticketCards}

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td>
                  <p style="margin:0;color:rgba(240,238,248,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Total Amount Paid</p>
                  <p style="margin:4px 0 0;color:#9F67FE;font-size:22px;font-weight:800;">${amount === 0 ? "Free" : `&#x20A6;${amount.toLocaleString()}`}</p>
                </td>
              </tr>
            </table>

            <div style="background:rgba(255,183,0,0.08);border:1px solid rgba(255,183,0,0.2);border-radius:10px;padding:16px;">
              <p style="margin:0;color:rgba(255,183,0,0.9);font-size:13px;font-weight:600;">📱 At the door</p>
              <p style="margin:6px 0 0;color:rgba(240,238,248,0.6);font-size:13px;line-height:1.5;">
                ${multiple
                  ? "Each attendee shows their own ticket's QR code separately — one scan per person."
                  : "Show this email or your QR code in the FlexPass app. Keep the Ticket ID handy."}
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(240,238,248,0.3);font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} FlexPass &middot; Lagos, Nigeria<br/>
              Questions? <a href="mailto:flexpasshome@gmail.com" style="color:rgba(159,103,254,0.6);text-decoration:none;">flexpasshome@gmail.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
