import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { logPaymentEvent } from '@/lib/logPaymentEvent';

// Resend delivers webhooks signed the Svix way (svix-id / svix-timestamp /
// svix-signature headers, HMAC-SHA256 over "${id}.${timestamp}.${rawBody}",
// signing key is "whsec_<base64>"). No svix package needed — this mirrors
// the same manual-HMAC pattern already used for the Paystack webhook.
const TOLERANCE_SECONDS = 5 * 60;

function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // svix-signature can carry multiple space-separated "v1,<base64sig>" pairs
  // (key rotation) — valid if any of them match.
  return svixSignature.split(' ').some(entry => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let parsedForLogging: any = null;
  try { parsedForLogging = JSON.parse(rawBody); } catch { /* logged as null below */ }

  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET missing — cannot verify incoming webhook');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    if (!verifySignature(rawBody, request.headers, secret)) {
      await logPaymentEvent({
        source: 'resend-webhook', eventType: 'invalid_signature', status: 'error',
        email: parsedForLogging?.data?.to?.[0] || null,
        message: 'Signature verification failed — request rejected before processing',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = parsedForLogging ?? JSON.parse(rawBody);
    const eventType: string = event.type;
    const data = event.data || {};
    const recipient: string | null = Array.isArray(data.to) ? data.to[0] : data.to || null;

    // These are the only two outcomes that mean "the buyer almost certainly
    // never saw their ticket" — everything else (sent/delivered/opened/
    // clicked/delayed) either succeeded or isn't actionable on its own.
    // Feeds straight into the existing reconciliation cron's email_failed
    // report (app/api/cron/reconcile-payments/route.ts), which already knows
    // how to surface this event_type — no changes needed there.
    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      const reason = eventType === 'email.bounced'
        ? `Bounced${data.bounce?.type ? ` (${data.bounce.type}${data.bounce.subType ? `/${data.bounce.subType}` : ''})` : ''}`
        : 'Recipient marked as spam';
      await logPaymentEvent({
        source: 'resend-webhook', eventType: 'email_failed', status: 'error',
        email: recipient,
        message: `${reason} — subject: "${data.subject || 'unknown'}"`,
        metadata: { resendEmailId: data.email_id || null, resendEventType: eventType },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[resend-webhook] Unhandled error:', err);
    await logPaymentEvent({
      source: 'resend-webhook', eventType: 'unhandled_exception', status: 'error',
      email: parsedForLogging?.data?.to?.[0] || null,
      message: err?.message || String(err),
    });
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
