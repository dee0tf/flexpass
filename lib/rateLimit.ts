import type { SupabaseClient } from '@supabase/supabase-js';

/** Best-effort client IP on Vercel (first hop of x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Sliding-window limit backed by public.request_rate_limits (see the
 * 20261031 migration). Returns true when the request is allowed and records
 * it. Fails open — if the table is missing or the DB errors, the request is
 * allowed, so a rate-limit hiccup can never block a real buyer.
 *
 * Limits should be generous: a whole campus hostel can share one IP.
 */
export async function allowRequest(
  supabase: SupabaseClient,
  bucket: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, error } = await supabase
      .from('request_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .gte('created_at', since);
    if (error) return true;
    if ((count || 0) >= limit) return false;
    await supabase.from('request_rate_limits').insert({ bucket });
    return true;
  } catch {
    return true;
  }
}
