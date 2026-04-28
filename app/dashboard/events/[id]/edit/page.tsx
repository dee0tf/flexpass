"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, MapPin, DollarSign,
  Image as ImageIcon, Type, Clock, User, Plus, Trash2,
  CheckCircle2, AlertTriangle, Tag,
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { use } from "react";

const CATEGORIES = ["Music", "Tech", "Business", "Arts", "Food", "Nightlife", "Others"];

interface TierFormData {
  id?: string; name: string; price: string; quantity: string; isNew?: boolean;
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

  const [formData, setFormData] = useState({
    title: "", description: "", date: "", start_time: "",
    location: "", price: "", total_tickets: "",
    sales_end_date: "", organizer_name: "", image_url: "", category: "Music",
    custom_category: "",
  });
  const [tiers, setTiers] = useState<TierFormData[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }

      const { data: event, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error || !event) { router.push("/dashboard"); return; }
      if (event.user_id !== session.user.id) { router.push("/dashboard"); return; }

      const { data: existingTiers } = await supabase
        .from("ticket_tiers").select("*").eq("event_id", id).order("price", { ascending: true });

      setTiers(
        (existingTiers || []).map((t: any) => ({ id: t.id, name: t.name, price: t.price.toString(), quantity: t.quantity_available.toString() }))
      );
      if (!existingTiers || existingTiers.length === 0) {
        setTiers([{ name: "Regular", price: event.price?.toString() || "", quantity: event.total_tickets?.toString() || "", isNew: true }]);
      }

      // Detect if category is custom (not in CATEGORIES standard list)
      const stdCats = CATEGORIES.filter(c => c !== "Others");
      const isCustom = event.category && !stdCats.includes(event.category) && event.category !== "Others";

      setEventTitle(event.title);
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date,
        start_time: event.start_time || "",
        location: event.location,
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
  }, [id, router]);

  const addTier = () => setTiers([...tiers, { name: "", price: "", quantity: "", isNew: true }]);
  const removeTier = (i: number) => { if (tiers.length > 1) setTiers(tiers.filter((_, idx) => idx !== i)); };
  const updateTier = (i: number, field: keyof TierFormData, value: string) => {
    const u = [...tiers]; u[i] = { ...u[i], [field]: value }; setTiers(u);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tiers.some(t => !t.name || !t.price || !t.quantity)) return;
    setIsSaving(true);
    try {
      const minPrice = Math.min(...tiers.map(t => Number(t.price)));
      const totalTickets = tiers.reduce((acc, t) => acc + Number(t.quantity), 0);
      const finalCategory = formData.category === "Others" && formData.custom_category
        ? formData.custom_category : formData.category;

      const { error } = await supabase.from("events").update({
        title: formData.title, description: formData.description,
        date: formData.date, start_time: formData.start_time,
        location: formData.location, price: minPrice,
        total_tickets: totalTickets, sales_end_date: formData.sales_end_date,
        organizer_name: formData.organizer_name, image_url: formData.image_url,
        category: finalCategory,
      }).eq("id", id);
      if (error) throw error;

      const { error: tierError } = await supabase.from("ticket_tiers").upsert(
        tiers.map(t => ({ ...(t.id ? { id: t.id } : {}), event_id: id, name: t.name, price: Number(t.price), quantity_available: Number(t.quantity) })),
        { onConflict: "id" }
      );
      if (tierError) throw tierError;

      setShowSaved(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      // Show inline error instead of browser alert
      alert("Failed to save: " + msg);
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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--background)" }}>
      {showSaved && <SavedModal onClose={() => { setShowSaved(false); router.push("/dashboard"); }} />}
      {showDeleteModal && (
        <DeleteRequestModal
          eventId={id}
          eventTitle={eventTitle}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Edit Event</h1>
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-1.5 w-full grad-brand" />
          <form onSubmit={handleSubmit} className="p-8 space-y-8">

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
                <div>
                  <label className={labelClass} style={labelStyle}>Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange}
                    className={inputClass} style={inputStyle} required />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Start Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    <input type="time" name="start_time" value={formData.start_time} onChange={handleChange}
                      className={`${inputClass} pl-10`} style={inputStyle} required />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelClass} style={labelStyle}>Location / Venue</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    <input type="text" name="location" value={formData.location} onChange={handleChange}
                      className={`${inputClass} pl-10`} style={inputStyle} required />
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 pt-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <DollarSign className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Ticket Classes
                </h2>
                <button type="button" onClick={addTier}
                  className="text-sm font-semibold flex items-center gap-1 hover:opacity-80"
                  style={{ color: "var(--brand-indigo)" }}>
                  <Plus className="h-4 w-4" /> Add Ticket Class
                </button>
              </div>
              {tiers.map((tier, i) => (
                <div key={i} className="p-4 rounded-xl relative group" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {([
                      { label: "Class Name", field: "name" as const, type: "text", placeholder: "e.g. VIP" },
                      { label: "Price (₦)", field: "price" as const, type: "number", placeholder: "0" },
                      { label: "Quantity", field: "quantity" as const, type: "number", placeholder: "100" },
                    ] as const).map(f => (
                      <div key={f.field}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} value={tier[f.field]}
                          onChange={e => updateTier(i, f.field, e.target.value)}
                          className="w-full p-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition"
                          style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                          required />
                      </div>
                    ))}
                  </div>
                  {tiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(i)}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 transition opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <label className={labelClass} style={labelStyle}>Stop Selling Tickets On</label>
                <input type="datetime-local" name="sales_end_date" value={formData.sales_end_date} onChange={handleChange}
                  className={inputClass} style={{ ...inputStyle, colorScheme: "dark" }} required />
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
