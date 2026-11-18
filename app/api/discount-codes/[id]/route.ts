import { NextResponse } from 'next/server';
import { db, requireEventOwner, usageByCode, UUID_RE } from '@/lib/discountCodeAdmin';
import { friendlyError } from '@/lib/friendlyError';

async function loadOwnedCode(request: Request, id: string) {
  if (!UUID_RE.test(id)) return { error: 'Discount code not found.', status: 404 as const };
  const { data: code } = await db.from('discount_codes').select('id, event_id, code').eq('id', id).single();
  if (!code) return { error: 'Discount code not found — it may have been deleted. Refresh the page.', status: 404 as const };
  const auth = await requireEventOwner(request, code.event_id);
  if ('error' in auth) return { error: auth.error, status: auth.status };
  return { code: code as { id: string; event_id: string; code: string } };
}

// PATCH /api/discount-codes/:id { isActive } — switch a code on or off.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await loadOwnedCode(request, id);
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const { isActive } = await request.json();
  if (typeof isActive !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { error } = await db.from('discount_codes').update({ is_active: isActive }).eq('id', id);
  if (error) {
    console.error('[discount-codes PATCH]', error);
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/discount-codes/:id — only for codes nobody has used yet, so
// the record of discounted sales is never lost. Used codes get switched off.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await loadOwnedCode(request, id);
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const usage = await usageByCode([id]);
  const { count: pending } = await db
    .from('ticket_holds').select('id', { count: 'exact', head: true })
    .eq('discount_code_id', id).eq('status', 'active');
  if ((usage[id]?.used ?? 0) > 0 || (pending ?? 0) > 0) {
    return NextResponse.json({
      error: `"${owned.code.code}" has already been used, so it can't be deleted — that would lose the record of who got the discount. Switch it off instead and nobody else can use it.`,
    }, { status: 409 });
  }

  const { error } = await db.from('discount_codes').delete().eq('id', id);
  if (error) {
    console.error('[discount-codes DELETE]', error);
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
