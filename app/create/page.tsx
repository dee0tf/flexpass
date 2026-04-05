"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, MapPin, DollarSign,
  Image as ImageIcon, Type, Clock,
  AlertCircle, User, Plus, Trash2
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import AuthModal from "@/components/AuthModal";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TicketTier {
  name: string;
  price: string;
  quantity: string;
}

export default function CreateEvent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form State
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
  });

  // Ticket Tiers State (Default with one Standard tier)
  const [tiers, setTiers] = useState<TicketTier[]>([
    { name: "Regular", price: "", quantity: "" }
  ]);


  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // 1. Check Auth on Load & Listen for Changes
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setShowAuthModal(true);
      } else {
        setUser(user);
      }
      setIsAuthChecking(false);
    }
    checkUser();

    // Listen for auth state changes (e.g. login in modal, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setShowAuthModal(false);
      } else {
        setUser(null);
        setShowAuthModal(true);
      }
      setIsAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tier Management Functions
  const addTier = () => {
    setTiers([...tiers, { name: "", price: "", quantity: "" }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      const newTiers = [...tiers];
      newTiers.splice(index, 1);
      setTiers(newTiers);
    }
  };

  const updateTier = (index: number, field: keyof TicketTier, value: string) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!user) return;

    // Validation
    if (tiers.some(t => !t.name || !t.price || !t.quantity)) {
      alert("Please fill in all ticket tier details.");
      setIsLoading(false);
      return;
    }

    try {
      // Calculate aggregate values for the main events table
      const totalTickets = tiers.reduce((acc, t) => acc + Number(t.quantity), 0);
      const minPrice = Math.min(...tiers.map(t => Number(t.price)));

      // 1. Insert Event
      const { data: eventData, error: eventError } = await supabase.from("events").insert([
        {
          title: formData.title,
          description: formData.description,
          date: formData.date,
          start_time: formData.start_time,
          location: formData.location,
          price: minPrice, // Store lowest price for display sorting
          total_tickets: totalTickets,
          sales_end_date: formData.sales_end_date,
          organizer_name: formData.organizer_name,
          image_url: formData.image_url,
          category: formData.category,
          user_id: user.id,
        },
      ]).select().single();

      if (eventError) throw eventError;

      const newEventId = eventData.id;

      // 2. Insert Ticket Tiers
      const tiersToInsert = tiers.map(tier => ({
        event_id: newEventId,
        name: tier.name,
        price: Number(tier.price),
        quantity_available: Number(tier.quantity)
      }));

      const { error: tierError } = await supabase
        .from("ticket_tiers")
        .insert(tiersToInsert);

      if (tierError) throw tierError;

      alert("✨ Event Published Successfully with Ticket Tiers!");
      router.push("/dashboard");

    } catch (error: any) {
      alert("Failed to create event: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#581c87]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        title="Create an Event"
        description="Join FlexPass to start hosting amazing events and selling tickets instantly."
      />

      {/* COMPLETELY HIDE CONTENT unless user is authenticated */}
      {user && (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-slate-900">Create an Experience</h1>
            <p className="mt-2 text-slate-600">Launch your professional event in minutes.</p>
          </div>

          <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-slate-100">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">

              {/* Section 1: Event Details */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                  <Calendar className="h-5 w-5 text-[#f97316]" /> Event Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        name="title"
                        required
                        placeholder="e.g. Lagos Tech Fest 2026"
                        className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      name="description"
                      required
                      rows={4}
                      placeholder="What makes this event unmissable?"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                      onChange={handleChange}
                    />
                  </div>

                  {/* Organizer Name */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Host / Organizer Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        name="organizer_name"
                        required
                        placeholder="e.g. Vibe Africa or John Doe"
                        className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      name="date"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <input
                        type="time"
                        name="start_time"
                        required
                        className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location / Venue</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        name="location"
                        required
                        placeholder="e.g. Eko Hotel & Suites, VI"
                        className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Ticketing & Inventory */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2 pt-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-[#f97316]" /> Ticket Classes
                  </h2>
                  <button
                    type="button"
                    onClick={addTier}
                    className="text-sm text-[#581c87] font-semibold hover:text-[#f97316] flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add Ticket Class
                  </button>
                </div>

                <div className="space-y-4">
                  {tiers.map((tier, index) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Class Name */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Class Name</label>
                          <input
                            type="text"
                            placeholder="e.g. VIP, Regular"
                            value={tier.name}
                            onChange={(e) => updateTier(index, "name", e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none text-sm"
                            required
                          />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Price (₦)</label>
                          <input
                            type="number"
                            placeholder="0"
                            min="0"
                            value={tier.price}
                            onChange={(e) => updateTier(index, "price", e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none text-sm"
                            required
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                          <input
                            type="number"
                            placeholder="100"
                            min="1"
                            value={tier.quantity}
                            onChange={(e) => updateTier(index, "quantity", e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none text-sm"
                            required
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTier(index)}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 transition opacity-0 group-hover:opacity-100"
                          title="Remove Ticket Class"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sales Deadline */}
                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stop Selling Tickets On
                  </label>
                  <div className="relative">
                    <AlertCircle className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="datetime-local"
                      name="sales_end_date"
                      required
                      className="pl-10 pr-4 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none appearance-none"
                      style={{ colorScheme: 'light' }}
                      onChange={handleChange}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Ticket sales for all classes will close at this time.</p>
                </div>
              </div>

              {/* Section 3: Branding */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2 pt-4">
                  <ImageIcon className="h-5 w-5 text-[#f97316]" /> Branding
                </h2>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Event Image</label>
                    <ImageUpload
                      onUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      name="category"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none bg-white"
                      onChange={handleChange}
                    >
                      <option value="Music">Music</option>
                      <option value="Tech">Tech</option>
                      <option value="Business">Business</option>
                      <option value="Arts">Arts</option>
                      <option value="Food">Food</option>
                      <option value="Nightlife">Nightlife</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition flex items-center justify-center gap-2 mt-8"
                style={{ backgroundColor: "var(--brand-indigo)" }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Publishing...
                  </>
                ) : (
                  "Publish Event"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}