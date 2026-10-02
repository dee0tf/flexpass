// Supabase (PostgREST) silently caps every select at 1000 rows. Any query
// that sums or counts rows client-side — revenue, tickets per event, wallet
// balance — quietly undercounts once it crosses that line (the admin events
// list showed 57 tickets for an event that really had 115 once the platform
// passed 1000 tickets). This pages through with .range() until every row is in.
//
// `page` must build the SAME query each call with a stable sort (e.g.
// .order("id")), otherwise rows can shift between pages and be skipped or
// duplicated.

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
