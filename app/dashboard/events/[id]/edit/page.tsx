"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, DollarSign,
  Image as ImageIcon, Type, Clock, User, Trash2, Download, Ticket,
  CheckCircle2, AlertTriangle, AlertCircle, Tag, Mail, EyeOff, Copy, Check, KeyRound,
} from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import LocationPicker, { LocationData } from "@/components/LocationPicker";
import { Toast, ToastState, ToastType } from "@/components/Toast";
import { csvCell, downloadCSV } from "@/lib/exportCsv";
import { hostAmount } from "@/lib/hostAmount";
import { splitName } from "@/lib/splitName";
import { use } from "react";
import { fetchAllRows } from "@/lib/fetchAllRows";
import TierCard, { TierPresetRow, blankTier, publicMinPrice, type TierFields } from "@/components/TierCard";

const CATEGORIES = ["Music", "Tech", "Business", "Arts", "Food", "Nightlife", "Others"];

// uid is client-only — a stable React key so collapsing/removing one tier
// card never shifts another card's open/closed state.
interface TierFormData extends TierFields {
  id?: string; isNew?: boolean; uid: string;
}

const newTierRow = (t: TierFields): TierFormData => ({ ...t, isNew: true, uid: crypto.randomUUID() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toFormTier = (t: any): TierFormData => ({
  id: t.id, uid: t.id, name: t.name, price: t.price.toString(),
  quantity: t.quantity_available.toString(),
  ends_at: t.ends_at ? new Date(t.ends_at).toISOString().slice(0, 16) : "",
  group_size: (t.group_size ?? 1).toString(),
  is_hidden: t.is_hidden ?? false,
  description: t.description || "",
  is_flexible_group: !!t.min_quantity,
  min_quantity: (t.min_quantity ?? "10").toString(),
  bulk_discount_qty: (t.bulk_discount_qty ?? t.min_quantity ?? "10").toString(),
  bulk_discount_percent: (t.bulk_discount_percent ?? "").toString(),
});

// ── Issue Sponsored Ticket panel ─────────────────────────────────────
function IssueTicketPanel({ eventId, tierId, quantityAvailable }: { eventId: string; tierId: string; quantityAvailable: number }) {
  const [expanded, setExpanded] = useState(false);
  const [issuedList, setIssuedList] = useState<Array<{ id: string; user_name: string | null; user_email: string; created_at: string }>>([]);
  const [issuedLoaded, setIssuedLoaded] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [winnerEmail, setWinnerEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const loadIssued = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("id, user_name, user_email, created_at")
      .eq("tier_id", tierId)
      .eq("is_giveaway", true)
      .order("created_at", { ascending: false });
    setIssuedList(data || []);
    setIssuedLoaded(true);
  };

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!issuedLoaded) loadIssued();
  };

  const handleIssue = async () => {
    if (!winnerEmail.trim() || !winnerName.trim()) { setMessage({ text: "Name and email are required.", isError: true }); return; }
    setIssuing(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMessage({ text: "Please log in again.", isError: true }); return; }

      const res = await fetch("/api/issue-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId, tierId, email: winnerEmail.trim(), fullName: winnerName.trim(), quantity: Number(quantity) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue ticket");

      setMessage({ text: `Ticket issued to ${winnerEmail}`, isError: false });
      setWinnerName(""); setWinnerEmail(""); setQuantity("1");
      loadIssued();
    } catch (e: any) {
      setMessage({ text: e.message, isError: true });
    } finally {
      setIssuing(false);
    }
  };

  // Pressing Enter inside these inputs would otherwise bubble up and submit
  // the outer event-edit form, since this panel renders inside that <form>.
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleIssue(); }
  };
  const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "var(--card-bg)", border: "1px dashed var(--brand-indigo)" }}>
      <button type="button" onClick={handleExpand}
        className="w-full flex items-center justify-between text-xs font-semibold" style={{ color: "var(--brand-indigo)" }}>
        <span>🎁 Issue Sponsored Ticket{issuedLoaded ? ` — ${issuedList.length}/${quantityAvailable} issued` : ""}</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input type="text" placeholder="Guest name" value={winnerName} onChange={e => setWinnerName(e.target.value)}
              onKeyDown={onEnter} className="p-2 rounded-lg text-sm" style={inputStyle} />
            <input type="email" placeholder="Guest email" value={winnerEmail} onChange={e => setWinnerEmail(e.target.value)}
              onKeyDown={onEnter} className="p-2 rounded-lg text-sm" style={inputStyle} />
            <input type="number" placeholder="Qty" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
              onKeyDown={onEnter} className="p-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          {message && (
            <p className="text-xs font-medium" style={{ color: message.isError ? "#ef4444" : "#16a34a" }}>{message.text}</p>
          )}
          <button type="button" onClick={handleIssue} disabled={issuing}
            className="w-full py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            {issuing ? "Sending…" : "Send Ticket"}
          </button>
          {issuedList.length > 0 && (
            <div className="pt-2 space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Issued so far:</p>
              {issuedList.map(t => (
                <p key={t.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {t.user_name || "—"} ({t.user_email}) — {new Date(t.created_at).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Branded success modal ──────────────────────────────────────────
function SavedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl text-center animate-in zoom-in-95 duration-300"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="h-1.5 w-full grad-brand" />
        <div className="p-10 flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center">
            <span className="absolute h-20 w-20 rounded-full animate-ping" style={{ backgroundColor: "rgba(72,0,130,0.15)" }} />
            <div className="relative h-20 w-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(72,0,130,0.12)", border: "2px solid var(--brand-indigo)" }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-indigo)" }} />
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Event Updated!
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Your changes have been saved and are now live on the event page.
            </p>
          </div>
          <button onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request-to-delete modal ────────────────────────────────────────
function DeleteRequestModal({ eventId, eventTitle, onClose }: { eventId: string; eventTitle: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) { setErr("Please provide a reason for deletion."); return; }
    setSubmitting(true);
    setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErr("Please log in again."); return; }

      const res = await fetch("/api/admin/request-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSubmitted(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="h-1.5 w-full" style={{ backgroundColor: "#ef4444" }} />
        <div className="p-8">
          {submitted ? (
            <div className="text-center flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <CheckCircle2 className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Request Submitted</h3>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Your deletion request has been sent to FlexPass. We&apos;ll review and respond within 24–48 hours.
                </p>
              </div>
              <button onClick={onClose}
                className="w-full py-3 rounded-xl font-bold transition hover:opacity-80"
                style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold" style={{ color: "var(--text-primary)" }}>Request to Delete</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{eventTitle}</p>
                </div>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Events cannot be deleted directly. Provide a reason and our team will review your request.
              </p>
              <label className="text-sm font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>Reason for deletion</label>
              <textarea rows={4} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g. Event was cancelled, venue is no longer available..."
                className="w-full p-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition resize-none"
                style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />
              {err && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {err}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-60 bg-red-500">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Submit Request"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main edit page ─────────────────────────────────────────────────
export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const showToast = useCallback((message: string, type: ToastType = "error") => {
    setToast({ message, type });
  }, []);

  const [formData, setFormData] = useState({
    title: "", description: "", date: "", start_time: "",
    price: "", total_tickets: "",
    sales_end_date: "", organizer_name: "", image_url: "", category: "Music",
    custom_category: "",
  });
  const [locationData, setLocationData] = useState<LocationData>({
    location: "", lat: null, lng: null, locationReveal: false,
  });
  const [isUnlisted, setIsUnlisted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [scanCode, setScanCode] = useState<string | null>(null);
  const [scanCodeBusy, setScanCodeBusy] = useState(false);
  const [scanLinkCopied, setScanLinkCopied] = useState(false);
  const [tiers, setTiers] = useState<TierFormData[]>([]);
  const [removedTierIds, setRemovedTierIds] = useState<string[]>([]);
  // Individual attendee tickets sold per tier (keyed by tier id) — not
  // group-adjusted yet, see the render site for the group_size conversion.
  const [soldByTier, setSoldByTier] = useState<Record<string, number>>({});


  // Loads tiers (with their DB ids) and per-tier sold counts. Also re-run
  // after a save, so a just-added giveaway tier gets the id its Issue
  // Ticket panel needs without the host leaving and coming back.
  const loadTiers = useCallback(async (): Promise<number> => {
    const { data: existingTiers } = await supabase
      .from("ticket_tiers").select("*").eq("event_id", id).order("price", { ascending: true });

    setTiers((existingTiers || []).map(toFormTier));

    // Sold count per tier, so the host can see how many are left without
    // leaving this page. count-only queries, not row fetches, so this
    // stays accurate even for a tier sold past Supabase's default row cap.
    const soldMap: Record<string, number> = {};
    await Promise.all(
      (existingTiers || []).map(async (t: { id: string }) => {
        const { count } = await supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("tier_id", t.id)
          .in("status", ["valid", "scanned"]);
        soldMap[t.id] = count || 0;
      })
    );
    setSoldByTier(soldMap);
    return existingTiers?.length ?? 0;
  }, [id]);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }

      const { data: event, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error || !event) { router.push("/dashboard"); return; }
      if (event.user_id !== session.user.id) { router.push("/dashboard"); return; }

      const loadedCount = await loadTiers();
      if (loadedCount === 0) {
        setTiers([newTierRow({ ...blankTier(), name: "Regular", price: event.price?.toString() || "", quantity: event.total_tickets?.toString() || "" })]);
      }

      // Detect if category is custom (not in CATEGORIES standard list)
      const stdCats = CATEGORIES.filter(c => c !== "Others");
      const isCustom = event.category && !stdCats.includes(event.category) && event.category !== "Others";

      setEventTitle(event.title);
      setLocationData({
        location: event.location || "",
        lat: event.latitude ?? null,
        lng: event.longitude ?? null,
        locationReveal: event.location_reveal ?? false,
      });
      setIsUnlisted(event.is_unlisted ?? false);

      // scan_code lives in event_scan_codes now, not on `events` — that
      // table has RLS enabled with zero policies, so it's only reachable
      // through this server route (using the host's own session to prove
      // ownership), never through the client's anon-keyed queries above.
      fetch(`/api/host/generate-scan-code?eventId=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(res => res.json()).then(data => setScanCode(data.code ?? null)).catch(() => {});
      setFormData({
        title: event.title,
        description: event.description || "",
        // event.date comes back as a full timestamp ("2026-12-01T00:00:00+00:00")
        // since the DB column is timestamptz, but <input type="date"> requires
        // exactly YYYY-MM-DD — anything else and the browser silently renders
        // the field as empty (state still holds a value, the DOM input doesn't),
        // which then fails the field's `required` validation on every save.
        date: event.date ? new Date(event.date).toISOString().slice(0, 10) : "",
        start_time: event.start_time || "",
        price: event.price?.toString() || "",
        total_tickets: event.total_tickets?.toString() || "",
        sales_end_date: event.sales_end_date ? new Date(event.sales_end_date).toISOString().slice(0, 16) : "",
        organizer_name: event.organizer_name || "",
        image_url: event.image_url || "",
        category: isCustom ? "Others" : (event.category || "Others"),
        custom_category: isCustom ? event.category : "",
      });
      setIsLoading(false);

    }
    loadData();
  }, [id, router, loadTiers]);

  const addTier = (t: TierFields) => setTiers(prev => [...prev, newTierRow(t)]);
  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    const removed = tiers[i];
    if (removed.id) setRemovedTierIds(prev => [...prev, removed.id!]);
    setTiers(tiers.filter((_, idx) => idx !== i));
  };
  const updateTier = (i: number, patch: Partial<TierFields>) =>
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  // The copy is a brand-new row: no id, so save inserts it instead of
  // overwriting the original.
  const duplicateTier = (i: number) => setTiers(prev => {
    const { id: _id, uid: _uid, isNew: _isNew, ...fields } = prev[i];
    void _id; void _uid; void _isNew;
    const n = [...prev];
    n.splice(i + 1, 0, newTierRow({ ...fields, name: `${fields.name} (copy)` }));
    return n;
  });

  // Generates (or regenerates) the door-staff access code for this event.
  // Regenerating overwrites the stored value immediately, which is also how
  // a previously shared code/link gets revoked — /api/checkin and
  // /api/scanner-auth only ever compare against whatever's currently there.
  const handleGenerateScanCode = async () => {
    setScanCodeBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/host/generate-scan-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      setScanCode(data.code);
      setScanLinkCopied(false);
      showToast(scanCode ? "Access code regenerated — the old code/link no longer works" : "Access code generated", "success");
    } catch (err) {
      showToast("Failed to generate access code: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setScanCodeBusy(false);
    }
  };

  const handleExportTierCsv = async (tierId: string, tierName: string) => {
    const { data: tickets, error } = await fetchAllRows((from, to) => supabase
      .from("tickets")
      .select("id, user_name, user_email, total_amount_paid, fee_amount, status, created_at")
      .eq("event_id", id)
      .eq("tier_id", tierId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to));

    if (error || !tickets?.length) {
      showToast(`No ticket data for "${tierName}" yet`, "warning");
      return;
    }

    const header = ["Ticket ID", "First Name", "Last Name", "Email", "Amount (NGN)", "Status", "Date"];
    const rows = tickets.map(t => {
      const { firstName, lastName } = splitName(t.user_name);
      return [
        csvCell(t.id),
        csvCell(firstName || "N/A"),
        csvCell(lastName),
        csvCell(t.user_email),
        csvCell(hostAmount(t)),
        csvCell(t.status),
        csvCell(new Date(t.created_at).toLocaleDateString("en-NG")),
      ];
    });
    const safeTier = tierName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadCSV([header, ...rows], `flexpass_${safeTier}_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const incomplete = tiers.find(t => !t.name || !t.price || !t.quantity);
    if (incomplete) {
      showToast(`Finish the "${incomplete.name || "Untitled"}" ticket class — it needs a name, price and quantity.`, "error");
      return;
    }
    for (const t of tiers) {
      if (!t.is_flexible_group) continue;
      const minQty = Number(t.min_quantity);
      const discQty = Number(t.bulk_discount_qty);
      const discPct = Number(t.bulk_discount_percent);
      if (!minQty || minQty < 1) {
        showToast(`"${t.name || "Untitled"}" is a flexible group ticket — set a minimum quantity.`, "error");
        return;
      }
      if (t.bulk_discount_qty && discQty < minQty) {
        showToast(`"${t.name || "Untitled"}": the discount threshold can't be below the minimum quantity.`, "error");
        return;
      }
      if (t.bulk_discount_percent && (discPct < 0 || discPct > 100)) {
        showToast(`"${t.name || "Untitled"}": discount percent must be between 0 and 100.`, "error");
        return;
      }
    }
    setIsSaving(true);
    try {
      const minPrice = publicMinPrice(tiers);
      const totalTickets = tiers.reduce((acc, t) => acc + Number(t.quantity) * (Number(t.group_size) || 1), 0);
      const finalCategory = formData.category === "Others" && formData.custom_category
        ? formData.custom_category : formData.category;

      const { error } = await supabase.from("events").update({
        title: formData.title, description: formData.description,
        date: formData.date, start_time: formData.start_time,
        location: locationData.location || "TBA",
        latitude: locationData.lat,
        longitude: locationData.lng,
        location_reveal: locationData.locationReveal,
        price: minPrice,
        total_tickets: totalTickets,
        // Empty string isn't a valid timestamptz — Postgres rejects it outright.
        // A blank field means "no cutoff", which must be written as null.
        sales_end_date: formData.sales_end_date ? new Date(formData.sales_end_date).toISOString() : null,
        organizer_name: formData.organizer_name, image_url: formData.image_url,
        category: finalCategory,
        is_unlisted: isUnlisted,
      }).eq("id", id);
      if (error) throw error;

      // Split into two batches: PostgREST requires every row in a bulk
      // insert/upsert to have the SAME set of keys. Mixing existing tiers
      // (with `id`) and new tiers (without `id`) in one call fails, which is
      // why adding a new ticket class errored on save.
      const existingTiers = tiers
        .filter(t => t.id)
        .map(t => ({
          id: t.id,
          event_id: id, name: t.name,
          price: Number(t.price),
          quantity_available: Number(t.quantity),
          ends_at: t.ends_at ? new Date(t.ends_at).toISOString() : null,
          group_size: Number(t.group_size) || 1,
          is_hidden: t.is_hidden ?? false,
          description: t.description.trim() || null,
          min_quantity: t.is_flexible_group ? Number(t.min_quantity) || null : null,
          bulk_discount_qty: t.is_flexible_group && t.bulk_discount_qty ? Number(t.bulk_discount_qty) : null,
          bulk_discount_percent: t.is_flexible_group && t.bulk_discount_percent ? Number(t.bulk_discount_percent) : null,
        }));
      const newTiers = tiers
        .filter(t => !t.id)
        .map(t => ({
          event_id: id, name: t.name,
          price: Number(t.price),
          quantity_available: Number(t.quantity),
          ends_at: t.ends_at ? new Date(t.ends_at).toISOString() : null,
          group_size: Number(t.group_size) || 1,
          is_hidden: t.is_hidden ?? false,
          description: t.description.trim() || null,
          min_quantity: t.is_flexible_group ? Number(t.min_quantity) || null : null,
          bulk_discount_qty: t.is_flexible_group && t.bulk_discount_qty ? Number(t.bulk_discount_qty) : null,
          bulk_discount_percent: t.is_flexible_group && t.bulk_discount_percent ? Number(t.bulk_discount_percent) : null,
        }));

      if (existingTiers.length) {
        const { error: upsertError } = await supabase
          .from("ticket_tiers").upsert(existingTiers, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }
      if (newTiers.length) {
        const { error: insertError } = await supabase
          .from("ticket_tiers").insert(newTiers);
        if (insertError) throw insertError;
      }
      if (removedTierIds.length) {
        const { error: deleteError } = await supabase
          .from("ticket_tiers").delete().in("id", removedTierIds).eq("event_id", id);
        if (deleteError) throw deleteError;
        setRemovedTierIds([]);
      }

      // A sponsored tier is only useful once it has an id to issue against —
      // so instead of the "saved" modal (which sends the host back to the
      // dashboard), stay here and reload so its Issue Ticket panel appears.
      const addedSponsored = tiers.some(t => !t.id && t.is_hidden);
      await loadTiers();
      if (addedSponsored) {
        showToast("Saved. Your sponsored tier is ready — use “Issue Sponsored Ticket” on it below to send tickets to your guests.", "success");
      } else {
        setShowSaved(true);
      }
    } catch (error: unknown) {
      // Supabase errors are plain objects with a `message` property, not
      // real Error instances — `instanceof Error` misses them entirely and
      // was silently collapsing every real error down to "Unknown error".
      const msg = error instanceof Error
        ? error.message
        : (error && typeof error === "object" && "message" in error)
          ? String((error as { message: unknown }).message)
          : "Unknown error";
      console.error("[edit event] Save failed:", error);
      showToast("Failed to save: " + msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isLoading) return (
    <div className="p-10 text-center">
      <Loader2 className="animate-spin inline" style={{ color: "var(--brand-indigo)" }} />
    </div>
  );

  const labelClass = "block text-sm font-medium mb-1.5";
  const labelStyle = { color: "var(--text-secondary)" };
  const inputClass = "w-full p-3 rounded-xl focus:outline-none focus:ring-2 transition";
  const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="min-h-screen py-12 px-2 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--background)" }}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {showSaved && <SavedModal onClose={() => { setShowSaved(false); router.push("/dashboard"); }} />}
      {showDeleteModal && (
        <DeleteRequestModal
          eventId={id}
          eventTitle={eventTitle}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10 gap-3">
          <h1 className="text-xl sm:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Edit Event</h1>
          <Link
            href={`/dashboard/events/${id}/email`}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-semibold text-sm transition hover:opacity-90 shrink-0"
            style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}
          >
            <Mail size={15} /> <span className="hidden sm:inline">Email </span>Attendees
          </Link>
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-1.5 w-full grad-brand" />
          <form onSubmit={handleSubmit} className="p-3 sm:p-8 space-y-8">

            {/* Event Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 pb-2" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--card-border)" }}>
                <Calendar className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Event Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className={labelClass} style={labelStyle}>Event Title</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    <input type="text" name="title" value={formData.title} onChange={handleChange}
                      className={`${inputClass} pl-10`} style={inputStyle} required />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelClass} style={labelStyle}>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange}
                    rows={4} className={inputClass} style={inputStyle} required />
                </div>
                <div className="col-span-2">
                  <label className={labelClass} style={labelStyle}>Host / Organizer Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    <input type="text" name="organizer_name" value={formData.organizer_name} onChange={handleChange}
                      className={`${inputClass} pl-10`} style={inputStyle} required />
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="min-w-0">
                    <label className={labelClass} style={labelStyle}>Date</label>
                    <div className="relative min-w-0">
                      <Calendar className="absolute left-3 top-3.5 h-5 w-5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                      {/* appearance-none strips iOS Safari's native chrome for
                          this input type — without it, a FILLED-IN date value
                          renders at the OS's own native width and ignores our
                          CSS width entirely, blowing out past the card (empty
                          fields don't trigger this, which is why it only
                          showed up once a real date was set). */}
                      <input type="date" name="date" value={formData.date} onChange={handleChange}
                        className={`${inputClass} pl-10 min-w-0 appearance-none`} style={inputStyle} required />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className={labelClass} style={labelStyle}>Start Time</label>
                    <div className="relative min-w-0">
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                      <input type="time" name="start_time" value={formData.start_time} onChange={handleChange}
                        className={`${inputClass} pl-10 min-w-0 appearance-none`} style={inputStyle} required />
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelClass} style={labelStyle}>Location / Venue</label>
                  <LocationPicker value={locationData} onChange={setLocationData} />
                </div>
                <div className="col-span-2 p-3 rounded-xl" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                  <label className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={isUnlisted} onChange={() => setIsUnlisted(v => !v)} />
                    <EyeOff className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
                    Make this a private / secret event
                  </label>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Won&apos;t appear on the home page, the Browse Events page, or search — only people with the direct event link can view and buy tickets.
                  </p>
                  {isUnlisted && (
                    <button type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                      style={{ backgroundColor: "var(--card-bg)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
                      {linkCopied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy shareable link</>}
                    </button>
                  )}
                </div>
                <div className="col-span-2 p-3 rounded-xl" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                  <p className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    <KeyRound className="h-4 w-4" style={{ color: "var(--brand-indigo)" }} />
                    Door Staff Access
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Share a code with whoever is scanning tickets at the door — they can check people in without needing your login. Regenerating replaces the old code, so a previously shared link stops working.
                  </p>
                  {scanCode && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-widest px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}>
                        {scanCode}
                      </span>
                      <button type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/checkin/${id}`);
                          setScanLinkCopied(true);
                          setTimeout(() => setScanLinkCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80"
                        style={{ backgroundColor: "var(--card-bg)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
                        {scanLinkCopied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy scanner link</>}
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={handleGenerateScanCode} disabled={scanCodeBusy}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: "var(--card-bg)", color: "var(--text-secondary)", border: "1px solid var(--card-border)" }}>
                    {scanCodeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {scanCode ? "Regenerate code" : "Generate code"}
                  </button>
                </div>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 pt-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <DollarSign className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Ticket Classes
                </h2>
              </div>
              <div className="space-y-3">
                {tiers.map((tier, i) => {
                  const groupSize = Number(tier.group_size) || 1;
                  const groupsSold = tier.id ? (soldByTier[tier.id] ?? 0) / groupSize : 0;
                  const remaining = Math.max(0, (Number(tier.quantity) || 0) - groupsSold);
                  return (
                    <TierCard key={tier.uid} tier={tier}
                      // Sponsored tiers stay open: their Issue Ticket panel
                      // lives in the expanded card only.
                      defaultExpanded={!tier.id || tier.is_hidden}
                      onChange={patch => updateTier(i, patch)}
                      onDuplicate={() => duplicateTier(i)}
                      onRemove={tiers.length > 1 ? () => removeTier(i) : undefined}
                      sponsoredNote={tier.id ? "Hidden from buyers. Issue tickets to your guests below — they get the ticket at its full value without paying." : "Hidden from buyers. Save the event, then issue tickets to your guests here."}
                      status={tier.id ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          <Ticket className="h-3.5 w-3.5" />
                          <span>{groupsSold} sold</span>
                          <span>&middot;</span>
                          <span style={{ color: remaining <= 0 ? "#ef4444" : "var(--text-secondary)", fontWeight: 700 }}>
                            {remaining <= 0 ? "Sold out" : `${remaining} left`}
                          </span>
                        </div>
                      ) : undefined}
                      extras={tier.id ? (
                        <>
                          {tier.is_hidden && (
                            <IssueTicketPanel eventId={id} tierId={tier.id} quantityAvailable={Number(tier.quantity) || 0} />
                          )}
                          <button type="button" onClick={() => handleExportTierCsv(tier.id!, tier.name || "tier")}
                            className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition px-3 py-1.5 rounded-lg hover:bg-[var(--input-bg)]"
                            style={{ color: "var(--text-secondary)" }}
                            title="Download this ticket class's sales as CSV">
                            <Download className="h-3.5 w-3.5" /> Download CSV
                          </button>
                        </>
                      ) : undefined} />
                  );
                })}
              </div>
              <TierPresetRow onAdd={addTier} />
              <div className="pt-2">
                <label className={labelClass} style={labelStyle}>Stop Selling Tickets On</label>
                <div className="relative w-full sm:w-1/2 min-w-0">
                  <AlertCircle className="absolute left-3 top-3.5 h-5 w-5 pointer-events-none z-10" style={{ color: "var(--text-muted)" }} />
                  <input type="datetime-local" name="sales_end_date" value={formData.sales_end_date} onChange={handleChange}
                    className={`${inputClass} pl-10 min-w-0 appearance-none`} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Leave blank to keep ticket sales open with no cutoff date.</p>
              </div>
            </div>

            {/* Branding */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 pb-2 pt-4" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--card-border)" }}>
                <ImageIcon className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Branding
              </h2>
              <div>
                <label className={labelClass} style={labelStyle}>Event Image</label>
                <ImageUpload onUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))} defaultValue={formData.image_url} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>
                  <Tag className="inline h-4 w-4 mr-1 mb-0.5" style={{ color: "var(--brand-indigo)" }} />
                  Category
                </label>
                <select name="category" value={formData.category} onChange={handleChange}
                  className={inputClass} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {formData.category === "Others" && (
                  <div className="mt-3">
                    <input type="text" name="custom_category"
                      required={formData.category === "Others"}
                      placeholder="e.g. Sports, Comedy, Fashion..."
                      value={formData.custom_category} onChange={handleChange}
                      className={inputClass} style={inputStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Describe your event category.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Trash2 className="h-5 w-5" /> Request to Delete
              </button>
              <button type="submit" disabled={isSaving}
                className="flex-1 text-white px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
