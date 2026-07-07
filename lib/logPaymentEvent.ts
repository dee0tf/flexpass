import { createClient } from '@supabase/supabase-js';

// Dedicated service-role client — this log must always be writable
// regardless of which key/RLS context the calling route uses.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logPaymentEvent({
  source,
  eventType,
  status,
  reference,
  eventId,
  email,
  message,
  metadata,
}: {
  source: 'verify-payment' | 'claim-free-ticket' | 'webhook' | 'reconciliation';
  eventType: string;
  status: 'success' | 'error' | 'skipped';
  reference?: string | null;
  eventId?: string | null;
  email?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await supabase.from('payment_events').insert({
      source,
      event_type: eventType,
      status,
      reference: reference || null,
      event_id: eventId || null,
      email: email || null,
      message: message || null,
      metadata: metadata || null,
    });
  } catch (err) {
    // A logging failure must never break the actual payment/ticket flow.
    console.error('[logPaymentEvent] Failed to write log:', err);
  }
}
