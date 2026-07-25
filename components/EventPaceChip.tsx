import type { ElementType } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, Minus } from "lucide-react";
import { PaceStatus, PACE_LABEL } from "@/lib/eventPacing";

const STYLES: Record<PaceStatus, { bg: string; color: string; icon: ElementType }> = {
  sold_out:     { bg: "rgba(159,103,254,0.14)", color: "var(--brand-indigo)", icon: CheckCircle2 },
  selling_fast: { bg: "rgba(22,163,74,0.12)",   color: "#16a34a",             icon: TrendingUp },
  needs_push:   { bg: "rgba(250,178,25,0.16)",  color: "#b9740a",             icon: AlertTriangle },
  on_track:     { bg: "var(--surface-raised)",  color: "var(--text-secondary)", icon: Minus },
};

export default function EventPaceChip({ status, size = "sm" }: { status: PaceStatus; size?: "sm" | "xs" }) {
  const { bg, color, icon: Icon } = STYLES[status];
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px] gap-1" : "px-2.5 py-1 text-xs gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold shrink-0 ${pad}`}
      style={{ backgroundColor: bg, color, border: status === "on_track" ? "1px solid var(--card-border)" : "none" }}
    >
      <Icon size={size === "xs" ? 10 : 11} />
      {PACE_LABEL[status]}
    </span>
  );
}
