export type PaceStatus = "sold_out" | "selling_fast" | "needs_push" | "on_track";

export interface PaceInput {
  sold: number;
  capacity: number;
  velocity7d: number;
  velocityPrior7d: number;
  /** Days until the event starts; null for past events or unknown dates. */
  daysUntilEvent: number | null;
}

/**
 * Attendee-level capacity: tiers store capacity in "units" (a group tier's
 * unit is one group, e.g. a table of 5), so this multiplies back out to
 * individual attendee slots to stay comparable with ticket row counts.
 * Legacy no-tier events fall back to events.total_tickets.
 */
export function computeEventCapacity(
  tiers: { quantity_available: number | null; group_size?: number | null }[] | null | undefined,
  legacyTotal: number | null | undefined
): number {
  if (tiers && tiers.length > 0) {
    return tiers.reduce((sum, t) => sum + (t.quantity_available || 0) * (t.group_size || 1), 0);
  }
  return legacyTotal || 0;
}

/**
 * A heuristic "how is this event doing" label — deliberately simple rules
 * over exact statistics, same spirit as any product's "selling fast" badge.
 * Shared by the Overview and Analytics pages so the two never disagree.
 */
export function computeEventPace({ sold, capacity, velocity7d, velocityPrior7d, daysUntilEvent }: PaceInput): PaceStatus {
  if (capacity > 0 && sold >= capacity) return "sold_out";

  const sellThrough = capacity > 0 ? sold / capacity : 0;

  if (
    daysUntilEvent !== null &&
    daysUntilEvent >= 0 &&
    daysUntilEvent <= 14 &&
    sellThrough < 0.5 &&
    velocity7d <= velocityPrior7d
  ) {
    return "needs_push";
  }

  if (velocity7d > 0 && velocity7d >= velocityPrior7d * 1.2) return "selling_fast";
  if (capacity > 0 && velocity7d / capacity >= 0.04) return "selling_fast";

  return "on_track";
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  sold_out: "Sold out",
  selling_fast: "Selling fast",
  needs_push: "Needs a push",
  on_track: "On track",
};
