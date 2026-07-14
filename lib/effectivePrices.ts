import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Event cards show a flat events.price snapshot from whenever the event was
 * last saved (the lowest tier price at that time). Once that cheapest tier
 * sells out, the card should show the next tier's price instead of staying
 * pinned to a price buyers can no longer actually get.
 */
export async function attachEffectivePrices<T extends { id: string; price: number }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  events: T[]
): Promise<T[]> {
  if (events.length === 0) return events;
  const eventIds = events.map(e => e.id);

  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("id, event_id, price, quantity_available, group_size")
    .in("event_id", eventIds)
    .eq("is_hidden", false);

  if (!tiers || tiers.length === 0) return events;

  // Count-only queries (not row fetches) so this stays accurate even for a
  // tier sold past Supabase's default row cap.
  const remainingByTier: Record<string, number> = {};
  await Promise.all(
    tiers.map(async (t) => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("tier_id", t.id)
        .in("status", ["valid", "scanned"]);
      const groupSize = t.group_size || 1;
      const groupsSold = (count || 0) / groupSize;
      remainingByTier[t.id] = Math.max(0, t.quantity_available - groupsSold);
    })
  );

  const tiersByEvent = new Map<string, typeof tiers>();
  for (const t of tiers) {
    const list = tiersByEvent.get(t.event_id) ?? [];
    list.push(t);
    tiersByEvent.set(t.event_id, list);
  }

  return events.map((e) => {
    const eventTiers = tiersByEvent.get(e.id);
    if (!eventTiers || eventTiers.length === 0) return e;
    const available = eventTiers.filter((t) => remainingByTier[t.id] > 0);
    const pool = available.length > 0 ? available : eventTiers;
    return { ...e, price: Math.min(...pool.map((t) => t.price)) };
  });
}
