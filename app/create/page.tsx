"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, MapPin, DollarSign,
  Image as ImageIcon, Type, Clock,
  AlertCircle, User, Plus, Trash2, CheckCircle2, Tag,
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import AuthModal from "@/components/AuthModal";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORIES = ["Music", "Tech", "Business", "Arts", "Food", "Nightlife", "Others"];

interface TicketTier {
  name: string;
  price: string;
  quantity: string;
}

function SuccessModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
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
              Event Published! 🎉
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Your event is live. Share it with the world and start selling tickets.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Link href={`/events/${eventId}`}
              className="w-full py-3 rounded-xl font-bold text-white text-center transition hover:opacity-90"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              View Event Page
            </Link>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-sm transition hover:opacity-80"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)" }}>
              Create Another Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateEvent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [successEventId, setSuccessEventId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "",
    location: "",
    sales_end_date: "",
    organizer_name: "",
    image_url: "",
    category: "Music",
    custom_category: "",
  });

  const [tiers, setTiers] = useState<TicketTier[]>([{ name: "Regular", price: "", quantity: "" }]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setShowAuthModal(true); }
      else {
        setUser(session.user);
        // Pre-fill organizer name from user metadata
        const meta = session.user.user_metadata;
        if (meta?.host_name || meta?.full_name) {
          setFormData(prev => ({ ...prev, organizer_name: meta.host_name || meta.full_name || "" }));
        }
      }
      setIsAuthChecking(false);
    }
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { setUser(session.user); setShowAuthModal(false); }
      else { setUser(null); setShowAuthModal(true); }
      setIsAuthChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const addTier = () => setTiers([...tiers, { name: "", price: "", quantity: "" }]);
  const removeTier = (i: number) => { if (tiers.length > 1) { const n = [...tiers]; n.splice(i, 1); setTiers(n); } };
  const updateTier = (i: number, field: keyof TicketTier, value: string) => {
    const n = [...tiers]; n[i][field] = value; setTiers(n);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!user) return;

    if (tiers.some(t => !t.name || !t.price || !t.quantity)) {
      setIsLoading(false); return;
    }

    const finalCategory = formData.category === "Others" && formData.custom_category
      ? formData.custom_category : formData.category;

    try {
      const totalTickets = tiers.reduce((acc, t) => acc + Number(t.quantity), 0);
      const minPrice = Math.min(...tiers.map(t => Number(t.price)));

      // Get creator social links from user metadata
      const meta = user.user_metadata || {};

      const { data: eventData, error: eventError } = await supabase.from("events").insert([{
        title: formData.title,
        description: formData.description,
        date: formData.date,
        start_time: formData.start_time,
        location: formData.location,
        price: minPrice,
        total_tickets: totalTickets,
        sales_end_date: formData.sales_end_date,
        organizer_name: formData.organizer_name,
        image_url: formData.image_url,
        category: finalCategory,
        user_id: user.id,
        instagram_url: meta.instagram_url || null,
        tiktok_url: meta.tiktok_url || null,
        twitter_url: meta.twitter_url || null,
      }]).select().single();

      if (eventError) throw eventError;

      const { error: tierError } = await supabase.from("ticket_tiers").insert(
        tiers.map(t => ({ event_id: eventData.id, name: t.name, price: Number(t.price), quantity_available: Number(t.quantity) }))
      );
      if (tierError) throw tierError;

      setSuccessEventId(eventData.id);
    } catch (error: any) {
      alert("Failed to create event: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isAuthChecking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
    </div>
  );

  const labelClass = "block text-sm font-medium mb-1.5";
  const labelStyle = { color: "var(--text-secondary)" };
  const inputClass = "w-full p-3 rounded-xl focus:outline-none focus:ring-2 transition";
  const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--background)" }}>
      {successEventId && (
        <SuccessModal
          eventId={successEventId}
          onClose={() => { setSuccessEventId(null); router.push("/dashboard"); }}
        />
      )}

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal}
        title="Create an Event"
        description="Join FlexPass to start hosting amazing events and selling tickets instantly." />

      {user && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Create an Experience</h1>
            <p className="mt-2" style={{ color: "var(--text-muted)" }}>Launch your professional event in minutes.</p>
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
                      <input type="text" name="title" required placeholder="e.g. Lagos Tech Fest 2026"
                        className={`${inputClass} pl-10`} style={inputStyle} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass} style={labelStyle}>Description</label>
                    <textarea name="description" required rows={4}
                      placeholder="What makes this event unmissable?"
                      className={inputClass} style={inputStyle} onChange={handleChange} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass} style={labelStyle}>Host / Organizer Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                      <input type="text" name="organizer_name" required value={formData.organizer_name}
                        placeholder="e.g. Vibe Africa or John Doe"
                        className={`${inputClass} pl-10`} style={inputStyle} onChange={handleChange} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Date</label>
                    <input type="date" name="date" required className={inputClass} style={inputStyle} onChange={handleChange} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Start Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                      <input type="time" name="start_time" required className={`${inputClass} pl-10`} style={inputStyle} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass} style={labelStyle}>Location / Venue</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 h-5 w-5" style={{ color: "var(--text-muted)" }} />
                      <input type="text" name="location" required placeholder="e.g. Eko Hotel & Suites, VI"
                        className={`${inputClass} pl-10`} style={inputStyle} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Tiers */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 pt-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <DollarSign className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Ticket Classes
                  </h2>
                  <button type="button" onClick={addTier}
                    className="text-sm font-semibold flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: "var(--brand-indigo)" }}>
                    <Plus className="h-4 w-4" /> Add Ticket Class
                  </button>
                </div>
                <div className="space-y-4">
                  {tiers.map((tier, i) => (
                    <div key={i} className="p-4 rounded-xl relative group" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { label: "Class Name", field: "name" as const, placeholder: "e.g. VIP, Regular", type: "text" },
                          { label: "Price (₦)", field: "price" as const, placeholder: "0", type: "number" },
                          { label: "Quantity", field: "quantity" as const, placeholder: "100", type: "number" },
                        ].map(f => (
                          <div key={f.field}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</label>
                            <input type={f.type} placeholder={f.placeholder} value={tier[f.field]}
                              onChange={e => updateTier(i, f.field, e.target.value)}
                              min={f.type === "number" ? "0" : undefined}
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
                </div>
                <div className="pt-2">
                  <label className={labelClass} style={labelStyle}>Stop Selling Tickets On</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-3 top-3.5 h-5 w-5 pointer-events-none z-10" style={{ color: "var(--text-muted)" }} />
                    <input type="datetime-local" name="sales_end_date" required
                      className={`${inputClass} pl-10`} style={{ ...inputStyle, colorScheme: "dark" }} onChange={handleChange} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Ticket sales for all classes will close at this time.</p>
                </div>
              </div>

              {/* Branding */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 pb-2 pt-4" style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--card-border)" }}>
                  <ImageIcon className="h-5 w-5" style={{ color: "var(--brand-amber)" }} /> Branding
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className={labelClass} style={labelStyle}>Event Image</label>
                    <ImageUpload onUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))} />
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
                    {/* Custom category input shown when "Others" is selected */}
                    {formData.category === "Others" && (
                      <div className="mt-3">
                        <input type="text" name="custom_category" required
                          placeholder="e.g. Sports, Comedy, Fashion..."
                          value={formData.custom_category}
                          onChange={handleChange}
                          className={inputClass} style={inputStyle} />
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Describe your event category.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition flex items-center justify-center gap-2 mt-8"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Publishing...</> : "Publish Event"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
