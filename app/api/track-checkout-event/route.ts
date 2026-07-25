import { NextResponse } from 'next/server';
import { logPaymentEvent } from '@/lib/logPaymentEvent';

// Client-facing funnel tracking for the checkout modal — this is what makes
// checkout completion rate computable at all: without it, payment_events
// only ever sees purchases that already succeeded or reached verify-payment,
// so there was no record of a checkout being opened, started, or abandoned.
const ALLOWED_EVENT_TYPES = new Set([
  'checkout_opened',
  'checkout_initiated',
  'checkout_abandoned',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, sessionId, eventId, email, tierId, tierName, quantity, isFree } = body;

    if (typeof eventType !== 'string' || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }
    if (typeof eventId !== 'string' || !eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    await logPaymentEvent({
      source: 'checkout-funnel',
      eventType,
      status: 'success',
      eventId,
      email: typeof email === 'string' ? email : null,
      metadata: {
        sessionId: typeof sessionId === 'string' ? sessionId : null,
        tierId: typeof tierId === 'string' ? tierId : null,
        tierName: typeof tierName === 'string' ? tierName : null,
        quantity: typeof quantity === 'number' ? quantity : null,
        isFree: !!isFree,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Tracking is best-effort — never surface a failure here as a user-facing error.
    console.error('[track-checkout-event] Failed:', err);
    return NextResponse.json({ ok: true });
  }
}
