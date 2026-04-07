"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, MapPin, DollarSign,
  Image as ImageIcon, Type, Clock, User, Plus, Trash2
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { use } from "react";

interface TierFormData {
  id?: string;
  name: string;
  price: string;
  quantity: string;
  isNew?: boolean;
}

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    title: "", description: "", date: "", start_time: "",
    location: "", price: "", total_tickets: "",
    sales_end_date: "", organizer_name: "", image_url: "", category: "Music",
  });

  const [tiers, setTiers] = useState<TierFormData[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { window.location.href = "/login"; return; }

      const { data: event, error } = await supabase
        .from("events").select("*").eq("id", id).single();

      if (error || !event) { alert("Event not found"); router.push("/dashboard"); return; }

      // Ownership check — only the event owner can edit
      if (event.user_id !== user.id) {
        alert("You are not authorized to edit this event.");
        router.push("/dashboard");
        return;
      }

      // Fetch existing tiers
      const { data: existingTiers } = await supabase
        .from("ticket_tiers").select("*").eq("event_id", id).order("price", { ascending: true });

      setTiers(
        (existingTiers || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          price: t.price.toString(),
          quantity: t.quantity_available.toString(),
        }))
      );

      if (!existingTiers || existingTiers.length === 0) {
        setTiers([{ name: "Regular", price: event.price?.toString() || "", quantity: event.total_tickets?.toString() || "", isNew: true }]);
      }

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
        category: event.category || "Others",
      });
      setIsLoading(false);
    }
    loadData();
  }, [id, router]);

  const addTier = () => setTiers([...tiers, { name: "", price: "", quantity: "", isNew: true }]);
  const removeTier = (i: number) => { if (tiers.length > 1) setTiers(tiers.filter((_, idx) => idx !== i)); };
  const updateTier = (i: number, field: keyof TierFormData, value: string) => {
    const updated = [...tiers]; updated[i] = { ...updated[i], [field]: value }; setTiers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tiers.some(t => !t.name || !t.price || !t.quantity)) {
      alert("Please fill in all ticket tier details."); return;
    }
    setIsSaving(true);
    try {
      const minPrice = Math.min(...tiers.map(t => Number(t.price)));
      const totalTickets = tiers.reduce((acc, t) => acc + Number(t.quantity), 0);

      const { error } = await supabase.from("events").update({
        title: formData.title, description: formData.description,
        date: formData.date, start_time: formData.start_time,
        location: formData.location, price: minPrice,
        total_tickets: totalTickets, sales_end_date: formData.sales_end_date,
        organizer_name: formData.organizer_name, image_url: formData.image_url,
        category: formData.category,
      }).eq("id", id);

      if (error) throw error;

      // Upsert tiers
      const tiersToUpsert = tiers.map(t => ({
        ...(t.id ? { id: t.id } : {}),
        event_id: id,
        name: t.name,
        price: Number(t.price),
        quantity_available: Number(t.quantity),
      }));

      const { error: tierError } = await supabase
        .from("ticket_tiers").upsert(tiersToUpsert, { onConflict: "id" });
      if (tierError) throw tierError;

      alert("✨ Event Updated Successfully!");
      router.push("/dashboard");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert("Failed to update event: " + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to DELETE this event? This cannot be undone.")) return;
    setIsDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { alert("Failed to delete: " + error.message); setIsDeleting(false); }
    else { alert("Event deleted."); router.push("/dashboard"); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline text-[#480082]" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Edit Event</h1>
        </div>

        <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-slate-100">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">

            {/* Event Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <Calendar className="h-5 w-5 text-[#FFB700]" /> Event Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input type="text" name="title" value={formData.title} onChange={handleChange}
                      className="pl-10 w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange}
                    rows={4} className="w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Host / Organizer Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input type="text" name="organizer_name" value={formData.organizer_name} onChange={handleChange}
                      className="pl-10 w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange}
                    className="w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input type="time" name="start_time" value={formData.start_time} onChange={handleChange}
                      className="pl-10 w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location / Venue</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input type="text" name="location" value={formData.location} onChange={handleChange}
                      className="pl-10 w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" required />
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2 pt-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-[#FFB700]" /> Ticket Classes
                </h2>
                <button type="button" onClick={addTier}
                  className="text-sm text-[#480082] font-semibold hover:text-[#FFB700] flex items-center gap-1 transition-colors">
                  <Plus className="h-4 w-4" /> Add Ticket Class
                </button>
              </div>
              {tiers.map((tier, index) => (
                <div key={index} className="bg-slate-50 p-4 rounded-xl border border-[#eDdedd] relative group">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Class Name</label>
                      <input type="text" placeholder="e.g. VIP, Regular" value={tier.name}
                        onChange={(e) => updateTier(index, "name", e.target.value)}
                        className="w-full p-2 rounded-lg border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Price (₦)</label>
                      <input type="number" placeholder="0" min="0" value={tier.price}
                        onChange={(e) => updateTier(index, "price", e.target.value)}
                        className="w-full p-2 rounded-lg border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                      <input type="number" placeholder="100" min="1" value={tier.quantity}
                        onChange={(e) => updateTier(index, "quantity", e.target.value)}
                        className="w-full p-2 rounded-lg border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none text-sm" required />
                    </div>
                  </div>
                  {tiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(index)}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 transition opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Stop Selling Tickets On</label>
                <input type="datetime-local" name="sales_end_date" value={formData.sales_end_date} onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none" style={{ colorScheme: "light" }} required />
              </div>
            </div>

            {/* Branding */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2 pt-4">
                <ImageIcon className="h-5 w-5 text-[#FFB700]" /> Branding
              </h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Image</label>
                <ImageUpload onUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))} defaultValue={formData.image_url} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select name="category" value={formData.category} onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-[#eDdedd] focus:ring-2 focus:ring-[#480082] focus:outline-none bg-white">
                  {["Music","Tech","Business","Arts","Food","Nightlife","Others"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={handleDelete} disabled={isDeleting}
                className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition flex items-center gap-2">
                {isDeleting ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                Delete Event
              </button>
              <button type="submit" disabled={isSaving}
                className="flex-1 bg-[#480082] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3a006b] transition flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
