import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveDiscount } from '@/lib/discountCodes';
import { sanitizeEmail } from '@/lib/sanitizeEmail';
import { allowRequest, clientIp } from '@/lib/rateLimit';

// discount_codes and ticket_holds are service-role only.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Per IP, per event — enough for a buyer fixing typos, too few to brute-force codes.
const VALIDATE_RATE_LIMIT = { limit: 20, windowSeconds: 600 };
const MAX_QUANTITY = 50;

/**
 * Checkout's "Apply" button. Only previews the discount — the price the buyer
 * is actually charged is fixed again by /api/ticket-hold when they pay.
 */
export async function POST(request: Request) {
  try {
    const { eventId, tierId, code, quantity, email } = await request.json();
    if (typeof eventId !== 'string' || typeof quantity !== 'number' || quantity < 1 || quantity > MAX_QUANTITY) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (!(await allowRequest(supabase, `discount:${eventId}:${clientIp(request)}`, VALIDATE_RATE_LIMIT))) {
      return NextResponse.json(
        { error: 'Too many code attempts — please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const result = await resolveDiscount(supabase, {
      eventId,
      tierId: typeof tierId === 'string' ? tierId : null,
      rawCode: code,
      quantity,
      email: typeof email === 'string' && email ? sanitizeEmail(email) : null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({
      code: result.code.code,
      label: result.label,
      // The client recomputes the price with these terms when quantity
      // changes (bulk discounts depend on quantity) — same math as the server.
      terms: result.terms,
      unitPrice: result.unitPrice,
    });
  } catch (err) {
    console.error('[discount/validate]', err);
    return NextResponse.json({ error: "We couldn't check that code right now. Please try again." }, { status: 500 });
  }
}
