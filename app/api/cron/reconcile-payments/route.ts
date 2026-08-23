import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createFallbackTicket } from '@/lib/createFallbackTicket';
import { logPaymentEvent } from '@/lib/logPaymentEvent';

// Never statically cache/optimize this route — it must hit live data every run.
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Skip anything younger than this — verify-payment is normally still in
// flight for a few seconds/minutes after payment; reconciling too eagerly
// would race a purchase that's about to resolve itself correctly.
const GRACE_MS = 3 * 60 * 1000;
// Bound how far back we look each run — old enough purchases have already
// been checked by prior runs, so this just limits cost, not correctness.
const WINDOW_MS = 24 * 60 * 60 * 1000;
// Tolerance for rounding when comparing paid amount to the expected tier price + fee.
const AMOUNT_TOLERANCE_KOBO = 100;
// How far back to check for unresolved email_failed events each run — a bit
// wider than the ~10min external cron interval so a slightly-delayed run
// never misses one, at the cost of occasionally reporting the same failure
// across two consecutive runs (harmless — far better than staying silent).
const EMAIL_ALERT_LOOKBACK_MS = 20 * 60 * 1000;

interface FixedRecord { reference: string; email: string; amountNaira: number; ticketIds: string[]; recoveredVia?: 'sibling' | 'amount_match' }
interface FlaggedRecord { reference: string; email: string | null; amountNaira: number; reason: string }
interface EmailFailureRecord { reference: string | null; email: string | null; source: string; message: string }

// When a successful transaction has no metadata (e.g. an abandoned first
// attempt carried it correctly, but a retry somehow didn't), look for
// another transaction from the same customer, close in time and for the
// same amount, that DOES have metadata — and borrow it to know what to
// create. This never substitutes for confirming the payment itself
// succeeded: the transaction we're building a ticket for is only ever
// reached here because it already came from Paystack's own status=success
// list (see the `candidates` filter below) — the sibling is used purely as
// a source of "what was this purchase for", not "did it get paid".
async function findSiblingMetadata(
  secretKey: string,
  email: string,
  referenceCreatedAt: string,
  referenceAmount: number
): Promise<Record<string, unknown> | null> {
  const SIBLING_WINDOW_MS = 30 * 60 * 1000;

  const res = await fetch('https://api.paystack.co/transaction?perPage=100', {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const txns: any[] = json.data || [];

  const targetTime = new Date(referenceCreatedAt).getTime();
  const candidates = txns.filter(t =>
    (t.customer?.email || '').toLowerCase() === email.toLowerCase() &&
    t.metadata?.event_id &&
    t.amount === referenceAmount &&
    Math.abs(new Date(t.created_at).getTime() - targetTime) < SIBLING_WINDOW_MS
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    Math.abs(new Date(a.created_at).getTime() - targetTime) - Math.abs(new Date(b.created_at).getTime() - targetTime)
  );
  return candidates[0].metadata;
}

// Last-resort recovery when metadata arrived truncated (observed on the bank
// transfer/USSD channel, cut off at a fixed ~69-char length by Paystack
// itself — confirmed via /transaction/verify, not just the webhook payload)
// and no sibling transaction exists to recover from either. event_id is the
// first key written into metadata client-side, so it usually survives the
// cut even when everything after it (name, tier, quantity) doesn't.
// Only trusts a match when the paid amount uniquely identifies one
// tier/quantity=1 combination for that event — an ambiguous match (e.g. two
// tiers priced the same) still falls through to manual review rather than
// guessing which one the buyer actually chose.
const EVENT_ID_RE = /"event_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

async function recoverEventIdAndTierFromAmount(
  rawMetadataString: string,
  amountKobo: number
): Promise<{ eventId: string; tierId: string | null; tierName: string } | null> {
  const eventIdMatch = rawMetadataString.match(EVENT_ID_RE);
  if (!eventIdMatch) return null;
  const eventId = eventIdMatch[1];

  const { data: tiers } = await supabase.from('ticket_tiers').select('id, name, price').eq('event_id', eventId);
  const candidates: { tierId: string | null; tierName: string }[] = [];

  if (tiers && tiers.length > 0) {
    for (const tier of tiers) {
      const fee = Math.round(tier.price * 0.05 * 100) / 100;
      const expectedKobo = Math.round((tier.price + fee) * 100);
      if (Math.abs(amountKobo - expectedKobo) <= AMOUNT_TOLERANCE_KOBO) {
        candidates.push({ tierId: tier.id, tierName: tier.name });
      }
    }
  } else {
    // Legacy (no-tier) event — match against the event's own flat price.
    const { data: eventRow } = await supabase.from('events').select('price').eq('id', eventId).single();
    if (eventRow) {
      const fee = Math.round(eventRow.price * 0.05 * 100) / 100;
      const expectedKobo = Math.round((eventRow.price + fee) * 100);
      if (Math.abs(amountKobo - expectedKobo) <= AMOUNT_TOLERANCE_KOBO) {
        candidates.push({ tierId: null, tierName: 'Standard' });
      }
    }
  }

  if (candidates.length !== 1) return null;
  return { eventId, tierId: candidates[0].tierId, tierName: candidates[0].tierName };
}

function buildReportHtml(fixed: FixedRecord[], flagged: FlaggedRecord[], emailFailures: EmailFailureRecord[]): string {
  const fixedRows = fixed.map(f => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.reference}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.email}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">₦${f.amountNaira.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.ticketIds.length}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${
        f.recoveredVia === 'sibling' ? 'Recovered from sibling txn'
        : f.recoveredVia === 'amount_match' ? 'Recovered from truncated metadata + amount match'
        : 'Normal'
      }</td>
    </tr>`).join('');

  const flaggedRows = flagged.map(f => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.reference}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.email || '(unknown)'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">₦${f.amountNaira.toLocaleString()}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.reason}</td>
    </tr>`).join('');

  const emailFailureRows = emailFailures.map(f => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.reference || '(unknown)'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.email || '(unknown)'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.source}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${f.message}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;">
  <h2>Payment Reconciliation Report</h2>
  ${fixed.length > 0 ? `
    <h3 style="color:#16a34a;">✅ Auto-fixed (${fixed.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <tr style="background:#f8f8f8;text-align:left;">
        <th style="padding:8px;">Reference</th><th style="padding:8px;">Email</th>
        <th style="padding:8px;">Amount</th><th style="padding:8px;">Tickets</th><th style="padding:8px;">How</th>
      </tr>
      ${fixedRows}
    </table>` : ''}
  ${flagged.length > 0 ? `
    <h3 style="color:#d97706;">⚠️ Needs manual review (${flagged.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <tr style="background:#f8f8f8;text-align:left;">
        <th style="padding:8px;">Reference</th><th style="padding:8px;">Email</th>
        <th style="padding:8px;">Amount</th><th style="padding:8px;">Reason</th>
      </tr>
      ${flaggedRows}
    </table>
    <p style="font-size:13px;color:#666;">These were deliberately left alone — check the payment_events table (source=reconciliation) for details before deciding what to do.</p>` : ''}
  ${emailFailures.length > 0 ? `
    <h3 style="color:#dc2626;">📧 Email delivery failed (${emailFailures.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <tr style="background:#f8f8f8;text-align:left;">
        <th style="padding:8px;">Reference</th><th style="padding:8px;">Email</th>
        <th style="padding:8px;">From</th><th style="padding:8px;">Error</th>
      </tr>
      ${emailFailureRows}
    </table>
    <p style="font-size:13px;color:#666;">The ticket(s) already exist for these — only the confirmation email failed to send (after 3 retry attempts). Resend manually.</p>` : ''}
</body>
</html>`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 });
  }

  const paystackRes = await fetch('https://api.paystack.co/transaction?perPage=100&status=success', {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!paystackRes.ok) {
    return NextResponse.json({ error: 'Failed to reach Paystack' }, { status: 502 });
  }
  const paystackJson = await paystackRes.json();
  const txns: any[] = paystackJson.data || [];

  const now = Date.now();
  const candidates = txns.filter(t => {
    const paidAt = new Date(t.paid_at || t.created_at).getTime();
    const age = now - paidAt;
    return age > GRACE_MS && age < WINDOW_MS;
  });

  const fixed: FixedRecord[] = [];
  const flagged: FlaggedRecord[] = [];

  for (const txn of candidates) {
    const reference: string = txn.reference;
    const amountNaira = txn.amount / 100;
    const customerEmail: string | undefined = txn.customer?.email;
    let metadata = txn.metadata || {};
    // Paystack has been observed returning metadata as a JSON string rather
    // than a parsed object (in the worst case, truncated mid-string) — this
    // caused a real ticket to get permanently flagged as "missing metadata"
    // instead of being recognized. Parse it when possible so this job can
    // actually self-heal that case instead of only flagging it.
    let rawMetadataString: string | null = null;
    if (typeof metadata === 'string') {
      rawMetadataString = metadata;
      try { metadata = JSON.parse(metadata); }
      catch { metadata = {}; } // falls through to sibling-recovery, then amount-match recovery, then flagging below
    }
    let recoveredVia: 'sibling' | 'amount_match' | undefined;

    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .in('purchase_reference', [reference, `${reference}-1`]);
    if (existing && existing.length > 0) continue; // already fine — most common case, no log noise

    if ((!metadata.event_id || !customerEmail) && customerEmail) {
      // txn itself is already confirmed status=success (see the candidates
      // filter above) — this lookup only recovers what the purchase was
      // for, never whether it was paid.
      const recovered = await findSiblingMetadata(secretKey, customerEmail, txn.created_at, txn.amount);
      if (recovered) {
        metadata = recovered;
        recoveredVia = 'sibling';
        await logPaymentEvent({
          source: 'reconciliation', eventType: 'recovered_metadata_from_sibling', status: 'success',
          reference, eventId: String(recovered.event_id || ''), email: customerEmail,
          message: 'Found matching metadata from a nearby transaction by the same customer',
        });
      }
    }

    // Last resort: metadata really did arrive truncated (not just missing)
    // and no sibling transaction existed to recover from — try pulling
    // event_id out of the raw string and matching the paid amount to exactly
    // one tier for that event. Only fires when nothing above already worked.
    if ((!metadata.event_id || !customerEmail) && customerEmail && rawMetadataString) {
      const recovered = await recoverEventIdAndTierFromAmount(rawMetadataString, txn.amount);
      if (recovered) {
        metadata = { event_id: recovered.eventId, tier_id: recovered.tierId, tier_name: recovered.tierName, quantity: 1 };
        recoveredVia = 'amount_match';
        await logPaymentEvent({
          source: 'reconciliation', eventType: 'recovered_metadata_from_amount_match', status: 'success',
          reference, eventId: recovered.eventId, email: customerEmail,
          message: `event_id recovered from truncated metadata via regex; tier inferred uniquely from paid amount (₦${amountNaira}) — tier_id=${recovered.tierId || 'legacy'}, tier_name=${recovered.tierName}`,
        });
      }
    }

    if (!metadata.event_id || !customerEmail) {
      flagged.push({ reference, email: customerEmail || null, amountNaira, reason: 'Missing event/tier metadata' });
      await logPaymentEvent({
        source: 'reconciliation', eventType: 'flagged_missing_metadata', status: 'skipped',
        reference, email: customerEmail || null,
        message: 'No event_id in metadata or no customer email, and no recoverable sibling or amount match found — cannot safely auto-create', metadata,
      });
      continue;
    }

    // Never auto-create a ticket for a refunded/charged-back payment.
    try {
      const refundRes = await fetch(`https://api.paystack.co/refund?transaction=${txn.id}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const refundJson = await refundRes.json();
      if (refundJson?.data?.length > 0) {
        flagged.push({ reference, email: customerEmail, amountNaira, reason: 'Transaction was refunded' });
        await logPaymentEvent({
          source: 'reconciliation', eventType: 'flagged_refunded', status: 'skipped',
          reference, eventId: metadata.event_id, email: customerEmail,
          message: 'Transaction has an associated refund — skipping auto-heal',
        });
        continue;
      }
    } catch (err) {
      flagged.push({ reference, email: customerEmail, amountNaira, reason: 'Refund check failed — needs manual look' });
      await logPaymentEvent({
        source: 'reconciliation', eventType: 'flagged_refund_check_failed', status: 'skipped',
        reference, eventId: metadata.event_id, email: customerEmail,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // Sanity-check the paid amount against the tier price before trusting it.
    if (metadata.tier_id) {
      const { data: tier } = await supabase.from('ticket_tiers').select('price').eq('id', metadata.tier_id).single();
      if (tier) {
        const quantity = metadata.quantity && Number(metadata.quantity) > 0 ? Number(metadata.quantity) : 1;
        const subtotal = tier.price * quantity;
        const fee = Math.round(subtotal * 0.05 * 100) / 100;
        const expectedKobo = Math.round((subtotal + fee) * 100);
        if (Math.abs(txn.amount - expectedKobo) > AMOUNT_TOLERANCE_KOBO) {
          flagged.push({ reference, email: customerEmail, amountNaira, reason: `Amount mismatch (paid ₦${amountNaira}, expected ₦${expectedKobo / 100})` });
          await logPaymentEvent({
            source: 'reconciliation', eventType: 'flagged_amount_mismatch', status: 'skipped',
            reference, eventId: metadata.event_id, email: customerEmail,
            message: `paid=${txn.amount} expected=${expectedKobo}`,
          });
          continue;
        }
      }
    }

    const result = await createFallbackTicket({
      source: 'reconciliation',
      reference,
      metadata,
      amountKobo: txn.amount,
      customerEmail,
      feesKobo: typeof txn.fees === 'number' ? txn.fees : undefined,
    });

    if (result.outcome === 'created' && result.ticketIds) {
      fixed.push({ reference, email: customerEmail, amountNaira, ticketIds: result.ticketIds, recoveredVia });
    } else if (result.outcome === 'insert_failed') {
      flagged.push({ reference, email: customerEmail, amountNaira, reason: 'Ticket insert failed — see payment_events' });
    }
  }

  // Surface unresolved email_failed events too — the ticket exists in these
  // cases, but nothing else would ever alert us that the confirmation email
  // itself never reached the buyer.
  const { data: emailFailureRows } = await supabase
    .from('payment_events')
    .select('reference, email, source, message')
    .eq('event_type', 'email_failed')
    .gte('created_at', new Date(now - EMAIL_ALERT_LOOKBACK_MS).toISOString());
  const emailFailures: EmailFailureRecord[] = emailFailureRows || [];

  if (fixed.length > 0 || flagged.length > 0 || emailFailures.length > 0) {
    try {
      await resend.emails.send({
        from: 'FlexPass <tickets@flexpasshq.com>',
        to: [process.env.ADMIN_EMAIL!],
        subject: `Payment reconciliation: ${fixed.length} fixed, ${flagged.length} flagged, ${emailFailures.length} email failures`,
        html: buildReportHtml(fixed, flagged, emailFailures),
      });
    } catch (err) {
      console.error('[reconcile] Failed to send report email:', err);
    }
  }

  return NextResponse.json({
    checked: candidates.length, fixed: fixed.length, flagged: flagged.length,
    emailFailures: emailFailures.length,
  });
}
