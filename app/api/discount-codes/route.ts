import { NextResponse } from 'next/server';
import { db, requireEventOwner, usageByCode, CODE_COLUMNS, UUID_RE } from '@/lib/discountCodeAdmin';
import { normalizeCode, MAX_DISCOUNT_SHARE } from '@/lib/discountMath';
import { friendlyError } from '@/lib/friendlyError';

// GET /api/discount-codes?eventId=... — the host's codes with usage.
export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('eventId') || '';
  const auth = await requireEventOwner(request, eventId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: codes, error } = await db
    .from('discount_codes').select(CODE_COLUMNS).eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) {
    console.error('[discount-codes GET]', error);
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
  const usage = await usageByCode((codes || []).map(c => c.id));
  return NextResponse.json({
    codes: (codes || []).map(c => ({ ...c, used: usage[c.id]?.used ?? 0, orders: usage[c.id]?.orders ?? 0 })),
  });
}

// POST /api/discount-codes — create a code.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const auth = await requireEventOwner(request, eventId);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json({ error: 'Codes must be 3 to 20 characters: letters, numbers, - or _ only (e.g. BLACKFRIDAY).' }, { status: 400 });
    }

    const type = body.discountType === 'fixed' ? 'fixed' : body.discountType === 'percent' ? 'percent' : null;
    const amount = Number(body.amount);
    if (!type) return NextResponse.json({ error: 'Choose whether the code takes a percentage or a naira amount off.' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter how much the code takes off — it must be more than 0.' }, { status: 400 });
    }
    if (type === 'percent' && amount > MAX_DISCOUNT_SHARE * 100) {
      return NextResponse.json({ error: `A discount code can take at most ${MAX_DISCOUNT_SHARE * 100}% off. For free tickets, use a Sponsored ticket class instead.` }, { status: 400 });
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if ((startsAt && isNaN(startsAt.getTime())) || (endsAt && isNaN(endsAt.getTime()))) {
      return NextResponse.json({ error: "One of the dates isn't valid — pick it again from the date picker." }, { status: 400 });
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: 'The end date must be after the start date.' }, { status: 400 });
    }
    if (endsAt && endsAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'The end date is already in the past — pick a future date.' }, { status: 400 });
    }

    let maxUses: number | null = null;
    if (body.maxUses !== '' && body.maxUses != null) {
      maxUses = Number(body.maxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1) {
        return NextResponse.json({ error: 'The usage limit must be a whole number of tickets, 1 or more — or leave it blank for no limit.' }, { status: 400 });
      }
    }

    // Tier limits: only this event's public (non-sponsored) tiers.
    let tierIds: string[] | null = null;
    if (Array.isArray(body.tierIds) && body.tierIds.length) {
      if (!body.tierIds.every((t: unknown) => typeof t === 'string' && UUID_RE.test(t))) {
        return NextResponse.json({ error: 'One of the selected ticket types is invalid. Refresh and try again.' }, { status: 400 });
      }
      const { data: tiers } = await db
        .from('ticket_tiers').select('id, is_hidden').eq('event_id', eventId).in('id', body.tierIds);
      const valid = (tiers || []).filter(t => !t.is_hidden).map(t => t.id);
      if (valid.length !== body.tierIds.length) {
        return NextResponse.json({ error: "Codes can only be limited to this event's public ticket types — not Sponsored ones." }, { status: 400 });
      }
      tierIds = valid;
    }

    const { data: created, error } = await db.from('discount_codes').insert({
      event_id: eventId,
      code,
      discount_type: type,
      amount,
      starts_at: startsAt?.toISOString() ?? null,
      ends_at: endsAt?.toISOString() ?? null,
      max_uses: maxUses,
      one_per_email: !!body.onePerEmail,
      tier_ids: tierIds,
      stacks_with_bulk: !!body.stacksWithBulk,
    }).select(CODE_COLUMNS).single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `You already have a code called "${code}" for this event. Pick a different name.` }, { status: 409 });
      }
      console.error('[discount-codes POST]', error);
      return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
    }
    return NextResponse.json({ code: { ...created, used: 0, orders: 0 } });
  } catch (err) {
    console.error('[discount-codes POST]', err);
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
