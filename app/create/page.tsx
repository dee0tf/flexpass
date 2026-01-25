"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Loader2, Calendar, MapPin, DollarSign,
  Image as ImageIcon, Type, Clock, Hash,
  AlertCircle, User
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CreateEvent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form State including NEW fields
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "", // New
    location: "",
    price: "",
    total_tickets: "", // New
    sales_end_date: "", // New
    organizer_name: "", // New
    image_url: "",
    category: "Music",
  });

  // 1. Check Auth on Load
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please login to create an event");
        router.push("/login");
      } else {
        setUser(user);
      }
    }
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!user) return;

    try {
      // 2. Insert Event with ALL new fields
      const { error } = await supabase.from("events").insert([
        {
          title: formData.title,
          description: formData.description,
          date: formData.date,
          start_time: formData.start_time,
          location: formData.location,
          price: Number(formData.price),
          total_tickets: Number(formData.total_tickets),
          sales_end_date: formData.sales_end_date, // Save the deadline
          organizer_name: formData.organizer_name,
          image_url: formData.image_url,
          category: formData.category,
          user_id: user.id, // Links event to YOU
        },
      ]);

      if (error) throw error;

      alert("✨ Event Published Successfully!");
      router.push("/dashboard");

    } catch (error: any) {
      console.error("Error:", error);
      alert("Failed to create event: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
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

                {/* Organizer Name - CLASSY TOUCH */}
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

            {/* Section 2: Ticketing */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b pb-2 pt-4">
                <DollarSign className="h-5 w-5 text-[#f97316]" /> Ticketing & Inventory
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ticket Price (₦)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="number"
                      name="price"
                      required
                      min="0"
                      placeholder="5000"
                      className="pl-10 pr-4 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none appearance-none"
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Total Tickets - CLASSY TOUCH */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Tickets Available</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="number"
                      name="total_tickets"
                      required
                      min="1"
                      placeholder="e.g. 100"
                      className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Sales Deadline - CLASSY TOUCH */}
                <div className="col-span-2">
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
                  <p className="text-xs text-slate-500 mt-1">Tickets sales will automatically close at this time.</p>
                </div>
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
                  {/* Hidden input to ensure required validation logic still works or we can just rely on the state check manually */}
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
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#f97316] to-[#581c87] text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-lg shadow-purple-100 flex items-center justify-center gap-2 mt-8"
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
    </div>
  );
}