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
      from: 'FlexPass <onboarding@resend.dev>',
      to: [email],
      subject: `You're going to ${safeTitle}! 🎟️`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #581c87;">Access Granted! ✅</h1>
          <p>Hi there,</p>
          <p>Your ticket for <strong>${safeTitle}</strong> is confirmed.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Ticket ID</p>
            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 18px;">${safeTicketId}</p>
            <br/>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Amount Paid</p>
            <p style="margin: 5px 0 0 0; font-weight: bold;">&#x20A6;${safeAmount.toLocaleString()}</p>
          </div>
          <p>Please show this email or your QR code at the entrance.</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">FlexPass Ticketing System</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
