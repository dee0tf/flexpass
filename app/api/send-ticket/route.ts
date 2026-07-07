import { NextResponse } from 'next/server';
import { sendTicketEmail } from '@/lib/sendTicketEmail';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, eventTitle, ticketIds, amount } = body;

    // Input validation
    if (!email || !eventTitle || !Array.isArray(ticketIds) || ticketIds.length === 0 || amount == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (ticketIds.some((id: unknown) => typeof id !== 'string' || id.length > 100)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    const safeAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(safeAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const { error } = await sendTicketEmail({ email, eventTitle, ticketIds, amount: safeAmount });

    if (error) {
      console.error('[send-ticket] Resend error:', error);
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    console.error('[send-ticket] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
