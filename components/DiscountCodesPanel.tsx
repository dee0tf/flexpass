"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Tag, Trash2, Plus, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendlyError";
import { discountLabel, normalizeCode, MAX_DISCOUNT_SHARE, codeDiscountOn } from "@/lib/discountMath";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  amount: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  one_per_email: boolean;
  tier_ids: string[] | null;
  excluded_tier_ids?: string[] | null;
  stacks_with_bulk: boolean;
  is_active: boolean;
  used: number;
  orders: number;
}

/** Public, saved tiers only — sponsored tiers can't take codes. */
export interface CodeTier { id: string; name: string; price: number; hasBulkDiscount: boolean }

const MAX_PERCENT = MAX_DISCOUNT_SHARE * 100;
const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1";
const inputCls = "w-full p-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition";
const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const blankForm = () => ({
  code: "", discountType: "percent" as "percent" | "fixed", amount: "", startsAt: "", endsAt: "",
  maxUses: "", onePerEmail: false, excludedTierIds: [] as string[], stacksWithBulk: false,
});

export default function DiscountCodesPanel({ eventId, tiers }: { eventId: string; tiers: CodeTier[] }) {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired. Please log in again.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/discount-codes?eventId=${eventId}`, { headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCodes(data.codes);
    } catch (e) {
      setMessage({ text: "Your discount codes couldn't be loaded. " + friendlyError(e), isError: true });
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof ReturnType<typeof blankForm>>(k: K, v: ReturnType<typeof blankForm>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleTier = (id: string) =>
    set("excludedTierIds", form.excludedTierIds.includes(id) ? form.excludedTierIds.filter(t => t !== id) : [...form.excludedTierIds, id]);

  // Tiers this code would apply to, for the live preview.
  const previewTiers = tiers.filter(t => !form.excludedTierIds.includes(t.id) && t.price > 0);
  const amountNum = Number(form.amount) || 0;
  const anyBulk = previewTiers.some(t => t.hasBulkDiscount);

  const create = async () => {
    setMessage(null);
    if (!normalizeCode(form.code)) {
      setMessage({ text: "Codes must be 3 to 20 characters: letters, numbers, - or _ only (e.g. BLACKFRIDAY).", isError: true });
      return;
    }
    if (amountNum <= 0) { setMessage({ text: "Enter how much the code takes off.", isError: true }); return; }
    if (form.discountType === "percent" && amountNum > MAX_PERCENT) {
      setMessage({ text: `A discount code can take at most ${MAX_PERCENT}% off.`, isError: true });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/discount-codes", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          eventId, ...form, amount: amountNum,
          // datetime-local is local time; send real timestamps.
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCodes(prev => [data.code, ...prev]);
      setForm(blankForm());
      setShowForm(false);
      setMessage({ text: `"${data.code.code}" is live — share it with your buyers.`, isError: false });
    } catch (e) {
      setMessage({ text: friendlyError(e), isError: true });
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (c: DiscountCode, isActive: boolean) => {
    setBusyId(c.id); setMessage(null);
    try {
      const res = await fetch(`/api/discount-codes/${c.id}`, { method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ isActive }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCodes(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: isActive } : x)));
    } catch (e) {
      setMessage({ text: friendlyError(e), isError: true });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: DiscountCode) => {
    setBusyId(c.id); setMessage(null);
    try {
      const res = await fetch(`/api/discount-codes/${c.id}`, { method: "DELETE", headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCodes(prev => prev.filter(x => x.id !== c.id));
    } catch (e) {
      setMessage({ text: friendlyError(e), isError: true });
    } finally {
      setBusyId(null);
    }
  };

  const status = (c: DiscountCode): { text: string; color: string } => {
    const now = Date.now();
    if (!c.is_active) return { text: "Off", color: "var(--text-muted)" };
    if (c.max_uses != null && c.used >= c.max_uses) return { text: "Used up", color: "#ef4444" };
    if (c.ends_at && Date.parse(c.ends_at) <= now) return { text: "Expired", color: "#ef4444" };
    if (c.starts_at && Date.parse(c.starts_at) > now) return { text: `Starts ${fmt(c.starts_at)}`, color: "var(--brand-amber)" };
    return { text: "Live", color: "#16a34a" };
  };

  return (
    <div className="rounded-3xl shadow-xl overflow-hidden mt-8" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="h-1.5 w-full grad-brand" />
      <div className="p-3 sm:p-8 space-y-4">
        <div className="flex items-center justify-between gap-3 pb-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Tag className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Discount Codes
          </h2>
          {!showForm && (
            <button type="button" onClick={() => { setShowForm(true); setMessage(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              <Plus className="h-3.5 w-3.5" /> New code
            </button>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Run promos like Black Friday. Buyers type the code at checkout. The discount comes off your ticket price, and FlexPass&apos;s 5% fee is worked out on the discounted price.
        </p>

        {message && (
          <p className="text-sm font-medium" style={{ color: message.isError ? "#ef4444" : "#16a34a" }}>{message.text}</p>
        )}

        {showForm && (
          <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls} style={{ color: "var(--text-muted)" }}>Code</label>
                <input type="text" placeholder="BLACKFRIDAY" value={form.code} maxLength={20}
                  onChange={e => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                  className={`${inputCls} uppercase tracking-wider`} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-muted)" }}>Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["percent", "fixed"] as const).map(t => (
                    <button key={t} type="button" onClick={() => set("discountType", t)}
                      className="py-2 rounded-lg text-xs font-semibold transition"
                      style={{
                        backgroundColor: form.discountType === t ? "rgba(72,0,130,0.12)" : "var(--input-bg)",
                        border: `1px solid ${form.discountType === t ? "var(--brand-indigo)" : "var(--input-border)"}`,
                        color: form.discountType === t ? "var(--brand-indigo)" : "var(--text-secondary)",
                      }}>
                      {t === "percent" ? "% off" : "₦ off"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-muted)" }}>
                  {form.discountType === "percent" ? `Percent off (max ${MAX_PERCENT})` : "Naira off per ticket"}
                </label>
                <input type="number" min="1" max={form.discountType === "percent" ? MAX_PERCENT : undefined}
                  placeholder={form.discountType === "percent" ? "30" : "2000"} value={form.amount}
                  onChange={e => set("amount", e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>

            {/* Live preview so the host sees exactly what buyers will pay */}
            {amountNum > 0 && previewTiers.length > 0 && (
              <div className="text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                {previewTiers.slice(0, 4).map(t => {
                  const off = codeDiscountOn(t.price, { discount_type: form.discountType, amount: amountNum, stacks_with_bulk: false });
                  const capped = form.discountType === "fixed" && amountNum > off;
                  return (
                    <p key={t.id}>
                      {t.name}: <span className="line-through opacity-60">₦{t.price.toLocaleString()}</span>{" "}
                      <b>₦{(t.price - off).toLocaleString()}</b>
                      {capped && <span style={{ color: "var(--brand-amber)" }}> (capped at {MAX_PERCENT}% off)</span>}
                    </p>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: "var(--text-muted)" }}>Starts (optional)</label>
                <input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)}
                  className={`${inputCls} appearance-none`} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--text-muted)" }}>Ends (optional)</label>
                <input type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)}
                  className={`${inputCls} appearance-none`} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
            </div>
            <p className="text-xs -mt-2" style={{ color: "var(--text-muted)" }}>
              For Black Friday, set it to start Friday 00:00 and end Monday 23:59. Leave blank to keep it running until you switch it off.
            </p>

            <div className="sm:w-1/2">
              <label className={labelCls} style={{ color: "var(--text-muted)" }}>Max tickets with this code (optional)</label>
              <input type="number" min="1" placeholder="No limit" value={form.maxUses}
                onChange={e => set("maxUses", e.target.value)} className={inputCls} style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>e.g. 100 = only the first 100 tickets get the discount. A table counts as one.</p>
            </div>

            {tiers.length > 1 && (
              <div>
                <p className={labelCls} style={{ color: "var(--text-muted)" }}>Exclude ticket types (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {tiers.map(t => {
                    const excluded = form.excludedTierIds.includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => toggleTier(t.id)} aria-pressed={excluded}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: excluded ? "rgba(239,68,68,0.12)" : "var(--input-bg)",
                          color: excluded ? "#ef4444" : "var(--text-secondary)",
                          border: excluded ? "1px solid rgba(239,68,68,0.5)" : "1px solid var(--input-border)",
                          textDecoration: excluded ? "line-through" : "none",
                        }}>
                        {excluded ? "✕ " : ""}{t.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {form.excludedTierIds.length === 0
                    ? "Works on all ticket types. Tap a ticket type to leave it out of the promo."
                    : `Works on everything except ${tiers.filter(t => form.excludedTierIds.includes(t.id)).map(t => t.name).join(", ")}. Ticket types you add later will get the discount too.`}
                </p>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" className="mt-1" checked={form.onePerEmail} onChange={e => set("onePerEmail", e.target.checked)} />
              <span>One use per person <span className="block text-xs" style={{ color: "var(--text-muted)" }}>Each email address can only use this code for one order.</span></span>
            </label>

            {anyBulk && (
              <label className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" className="mt-1" checked={form.stacksWithBulk} onChange={e => set("stacksWithBulk", e.target.checked)} />
                <span>
                  Add on top of group bulk discounts
                  <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                    Off: buyers get whichever discount is bigger. On: the code comes off the already-discounted group price.
                  </span>
                </span>
              </label>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setForm(blankForm()); setMessage(null); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button type="button" onClick={create} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create code
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-indigo)" }} />
        ) : codes.length === 0 && !showForm ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No discount codes yet.</p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => {
              const st = status(c);
              const excludedNames = (c.excluded_tier_ids || [])
                .map(id => tiers.find(t => t.id === id)?.name).filter(Boolean).join(", ");
              const tierNames = c.tier_ids?.length
                ? tiers.filter(t => c.tier_ids!.includes(t.id)).map(t => t.name).join(", ") || "Selected ticket types"
                : c.excluded_tier_ids?.length
                  ? `All except ${excludedNames || "some ticket types"}`
                  : "All ticket types";
              return (
                <div key={c.id} className="p-3 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3"
                  style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)", opacity: c.is_active ? 1 : 0.7 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold tracking-wider" style={{ color: "var(--text-primary)" }}>{c.code}</span>
                      <button type="button" aria-label="Copy code" title="Copy code"
                        onClick={() => { navigator.clipboard.writeText(c.code); setCopied(c.id); setTimeout(() => setCopied(null), 1500); }}
                        style={{ color: "var(--text-muted)" }}>
                        {copied === c.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(72,0,130,0.1)", color: "var(--brand-indigo)" }}>
                        {discountLabel(c)}
                      </span>
                      <span className="text-xs font-bold" style={{ color: st.color }}>● {st.text}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {c.used}{c.max_uses != null ? ` / ${c.max_uses}` : ""} ticket{c.used === 1 && c.max_uses == null ? "" : "s"} used
                      {" · "}{tierNames}
                      {c.ends_at ? ` · ends ${fmt(c.ends_at)}` : ""}
                      {c.one_per_email ? " · one per person" : ""}
                      {c.stacks_with_bulk ? " · stacks with bulk" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" disabled={busyId === c.id} onClick={() => setActive(c, !c.is_active)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}>
                      {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.is_active ? "Switch off" : "Switch on"}
                    </button>
                    {c.used === 0 && (
                      <button type="button" disabled={busyId === c.id} onClick={() => remove(c)} aria-label="Delete code" title="Delete code"
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
