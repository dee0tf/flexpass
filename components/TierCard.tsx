"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Trash2, Gift, Ticket, Users, UsersRound } from "lucide-react";
import FeeCalculator from "@/components/FeeCalculator";
import { buyerTotalFor } from "@/lib/platformFee";

/** The tier fields both the create and edit forms share. */
export interface TierFields {
  name: string;
  price: string;
  quantity: string;
  ends_at?: string;
  group_size: string;
  is_hidden: boolean;
  description: string;
  is_flexible_group: boolean;
  min_quantity: string;
  bulk_discount_qty: string;
  bulk_discount_percent: string;
}

export type TierType = "regular" | "bundle" | "group" | "sponsored";

/** Derived from fields already stored — no tier_type column needed. */
export function tierTypeOf(t: TierFields): TierType {
  if (t.is_hidden) return "sponsored";
  if (t.is_flexible_group) return "group";
  if ((Number(t.group_size) || 1) > 1) return "bundle";
  return "regular";
}

const TYPE_PATCH: Record<TierType, (t: TierFields) => Partial<TierFields>> = {
  regular: () => ({ is_hidden: false, is_flexible_group: false, group_size: "1" }),
  bundle: t => ({ is_hidden: false, is_flexible_group: false, group_size: (Number(t.group_size) || 1) > 1 ? t.group_size : "5" }),
  group: () => ({ is_hidden: false, is_flexible_group: true, group_size: "1" }),
  // Sponsored keeps its real price: it's the ticket's value, shown on the
  // tier and the attendee's email. The attendee just doesn't pay it.
  sponsored: () => ({ is_hidden: true, is_flexible_group: false, group_size: "1" }),
};

const TYPES: { type: TierType; label: string; icon: typeof Ticket; hint: string }[] = [
  { type: "regular", label: "Regular", icon: Ticket, hint: "One ticket, one person." },
  { type: "bundle", label: "Table / Bundle", icon: Users, hint: "Buyer pays once and gets a QR code for each person at the table." },
  { type: "group", label: "Group", icon: UsersRound, hint: "Buyer picks their own headcount, priced per ticket, with an optional bulk discount." },
  { type: "sponsored", label: "Sponsored", icon: Gift, hint: "Hidden from the public. You issue these yourself — the ticket keeps its price, the guest just doesn't pay it." },
];

/** The event's "from ₦X" price. Sponsored tiers are hidden from buyers,
 *  so they must not affect the price the public sees. */
export function publicMinPrice(tiers: TierFields[]): number {
  const visible = tiers.filter(t => !t.is_hidden);
  return Math.min(...(visible.length ? visible : tiers).map(t => Number(t.price)));
}

export const blankTier = (): TierFields => ({
  name: "", price: "", quantity: "", ends_at: "", group_size: "1", is_hidden: false, description: "",
  is_flexible_group: false, min_quantity: "10", bulk_discount_qty: "10", bulk_discount_percent: "",
});

/** One-tap starting points for the "Add ticket class" row. */
export const TIER_PRESETS: { label: string; make: () => TierFields }[] = [
  { label: "Early Bird", make: () => ({ ...blankTier(), name: "Early Bird" }) },
  { label: "Regular", make: () => ({ ...blankTier(), name: "Regular" }) },
  { label: "VIP", make: () => ({ ...blankTier(), name: "VIP" }) },
  { label: "Table of 5", make: () => ({ ...blankTier(), name: "Table of 5", group_size: "5" }) },
  { label: "Sponsored", make: () => ({ ...blankTier(), name: "Sponsored", is_hidden: true }) },
];

const naira = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1";
const inputCls = "w-full p-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition";
const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

export default function TierCard({
  tier, onChange, onRemove, onDuplicate, defaultExpanded = true, status, extras, sponsoredNote,
}: {
  tier: TierFields;
  onChange: (patch: Partial<TierFields>) => void;
  onRemove?: () => void;
  onDuplicate: () => void;
  defaultExpanded?: boolean;
  /** e.g. "12 sold · 38 left" on the edit page. */
  status?: ReactNode;
  /** Extra controls at the bottom of the open card (CSV export, issue tickets). */
  extras?: ReactNode;
  /** What a host does with a sponsored tier on this page. */
  sponsoredNote?: string;
}) {
  const type = tierTypeOf(tier);
  const complete = !!tier.name.trim() && tier.price !== "" && tier.quantity !== "";
  const [expanded, setExpanded] = useState(defaultExpanded || !complete);
  const [showMore, setShowMore] = useState(
    () => !!tier.ends_at || !!tier.description || /early/i.test(tier.name)
  );
  const set = (field: keyof TierFields) => (e: { target: { value: string } }) => onChange({ [field]: e.target.value });

  const priceNum = Number(tier.price) || 0;
  const groupSize = Number(tier.group_size) || 1;
  const priceSummary = type === "sponsored"
    ? `${naira(priceNum)} · sponsored`
    : priceNum === 0
      ? "Free"
      : `${naira(buyerTotalFor(priceNum))} at checkout${type === "bundle" ? ` per ${groupSize}` : type === "group" ? " each" : ""}`;
  const TypeIcon = TYPES.find(t => t.type === type)!.icon;

  if (!expanded) {
    return (
      <div className="p-3 sm:p-4 rounded-xl flex items-center gap-3"
        style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
        <TypeIcon className="h-4 w-4 shrink-0" style={{ color: type === "sponsored" ? "var(--brand-amber)" : "var(--brand-indigo)" }} />
        <button type="button" onClick={() => setExpanded(true)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
            {tier.name}
            {type === "sponsored" && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand-amber)" }}>Sponsored</span>}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {priceSummary} · {tier.quantity} {type === "bundle" ? "tables" : "available"}
            {tier.ends_at ? " · ends " + new Date(tier.ends_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : ""}
          </p>
          {status && <div className="mt-0.5">{status}</div>}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton label="Duplicate" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></IconButton>
          {onRemove && <IconButton label="Remove" onClick={onRemove} danger><Trash2 className="h-3.5 w-3.5" /></IconButton>}
          <IconButton label="Edit" onClick={() => setExpanded(true)}><ChevronDown className="h-4 w-4" /></IconButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
      {/* What kind of ticket — decides which fields show below */}
      <p className={labelCls} style={{ color: "var(--text-muted)" }}>Ticket type</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TYPES.map(({ type: t, label, icon: Icon }) => {
          const active = t === type;
          return (
            <button key={t} type="button" onClick={() => onChange(TYPE_PATCH[t](tier))}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition"
              style={{
                backgroundColor: active ? "rgba(72,0,130,0.12)" : "var(--input-bg)",
                border: `1px solid ${active ? "var(--brand-indigo)" : "var(--input-border)"}`,
                color: active ? "var(--brand-indigo)" : "var(--text-secondary)",
              }}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{TYPES.find(t => t.type === type)!.hint}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>Class Name</label>
          <input type="text" placeholder="e.g. VIP, Regular" value={tier.name} onChange={set("name")}
            className={inputCls} style={inputStyle} required />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            {type === "bundle" ? "Price per table (₦)" : type === "group" ? "Price per ticket (₦)" : type === "sponsored" ? "Ticket value (₦)" : "Price (₦)"}
          </label>
          <input type="number" placeholder="0" value={tier.price} onChange={set("price")} min="0"
            className={inputCls} style={inputStyle} required />
        </div>
        <div>
          <label className={labelCls} style={{ color: "var(--text-muted)" }}>
            {type === "bundle" ? "Tables available" : "Quantity"}
          </label>
          <input type="number" placeholder="100" value={tier.quantity} onChange={set("quantity")} min="0"
            className={inputCls} style={inputStyle} required />
        </div>
        {type === "bundle" && (
          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>People per table</label>
            <input type="number" placeholder="5" value={tier.group_size} onChange={set("group_size")} min="2"
              className={inputCls} style={inputStyle} />
          </div>
        )}
      </div>

      {type === "bundle" && (
        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
          Buyers pay once and get {groupSize > 1 ? groupSize : "N"} separate QR codes to share with their group.
        </p>
      )}

      {type === "group" && (
        <>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className={labelCls} style={{ color: "var(--text-muted)" }}>Min tickets</label>
              <input type="number" placeholder="10" value={tier.min_quantity} onChange={set("min_quantity")} min="1" max="50"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--text-muted)" }}>Discount from</label>
              <input type="number" placeholder="10" value={tier.bulk_discount_qty} onChange={set("bulk_discount_qty")} min="1" max="50"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--text-muted)" }}>Discount (%)</label>
              <input type="number" placeholder="10" value={tier.bulk_discount_percent} onChange={set("bulk_discount_percent")} min="0" max="100"
                className={inputCls} style={inputStyle} />
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            Buyers must pick at least {tier.min_quantity || "10"} tickets (up to 50).{" "}
            {tier.bulk_discount_percent
              ? `At ${tier.bulk_discount_qty || tier.min_quantity || "10"}+ tickets, each is ${tier.bulk_discount_percent}% off.`
              : "Leave the discount blank to charge the flat price."}
          </p>
        </>
      )}

      {type !== "sponsored"
        ? <FeeCalculator price={tier.price} onPriceChange={p => onChange({ price: p })} />
        : sponsoredNote && <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>{sponsoredNote}</p>}

      {status && <div className="mt-2">{status}</div>}

      {/* Rarely needed — tucked away so the common case stays short */}
      <button type="button" onClick={() => setShowMore(!showMore)}
        className="mt-3 flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition"
        style={{ color: "var(--text-secondary)" }}>
        {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        More options <span className="font-normal" style={{ color: "var(--text-muted)" }}>· sales end date, description</span>
      </button>
      {showMore && (
        <div className="mt-3 space-y-3">
          <div>
            <label className={labelCls} style={{ color: "var(--brand-amber)" }}>Stop selling this class on (optional)</label>
            <input type="datetime-local" value={tier.ends_at || ""} onChange={set("ends_at")}
              className={`${inputCls} sm:w-1/2 min-w-0 appearance-none`}
              style={{ ...inputStyle, border: "1px solid rgba(255,183,0,0.4)", colorScheme: "dark" }} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Great for Early Bird. Leave blank to keep it on sale.</p>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--text-muted)" }}>Description (optional)</label>
            <textarea rows={2} value={tier.description} onChange={set("description")}
              placeholder="e.g. Includes 2 bottles and reserved seating near the stage"
              className={`${inputCls} resize-none`} style={inputStyle} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Shown to buyers when they pick this class.</p>
          </div>
        </div>
      )}

      {extras}

      <div className="mt-3 pt-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--card-border)" }}>
        <div className="flex items-center gap-1">
          <TextButton onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /> Duplicate</TextButton>
          {onRemove && <TextButton onClick={onRemove} danger><Trash2 className="h-3.5 w-3.5" /> Remove</TextButton>}
        </div>
        <button type="button" onClick={() => setExpanded(false)} disabled={!complete}
          title={complete ? undefined : "Fill in the name, price and quantity first"}
          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: "var(--brand-indigo)" }}>
          Done
        </button>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`p-2 rounded-lg transition ${danger ? "text-red-500 hover:bg-red-50" : "hover:bg-[var(--input-bg)]"}`}
      style={danger ? undefined : { color: "var(--text-secondary)" }}>
      {children}
    </button>
  );
}

function TextButton({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-semibold transition px-3 py-1.5 rounded-lg ${danger ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "hover:bg-[var(--input-bg)]"}`}
      style={danger ? undefined : { color: "var(--text-secondary)" }}>
      {children}
    </button>
  );
}

/** The "+ Early Bird  + Regular  + VIP ..." row under the tier list. */
export function TierPresetRow({ onAdd }: { onAdd: (tier: TierFields) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Add:</span>
      {TIER_PRESETS.map(p => (
        <button key={p.label} type="button" onClick={() => onAdd(p.make())}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
          style={{ backgroundColor: "rgba(72,0,130,0.08)", border: "1px solid rgba(72,0,130,0.25)", color: "var(--brand-indigo)" }}>
          + {p.label}
        </button>
      ))}
      <button type="button" onClick={() => onAdd(blankTier())}
        className="px-3 py-1.5 rounded-full text-xs font-semibold transition hover:opacity-80"
        style={{ border: "1px dashed var(--input-border)", color: "var(--text-secondary)" }}>
        + Blank
      </button>
    </div>
  );
}
