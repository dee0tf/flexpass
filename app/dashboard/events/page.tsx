"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Calendar, MapPin, Ticket, ExternalLink } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MyEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setEvents(data || []);
      setLoading(false);
    }
    loadEvents();
  }, []);

  if (loading) return <div className="p-10"><Loader2 className="animate-spin text-[#581c87]" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Events</h1>
        <Link href="/create">
          <button className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#4c1d75] transition">
            + New Event
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
            <div className="h-32 bg-slate-100 relative">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
               <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold text-[#581c87]">
                 ₦{event.price.toLocaleString()}
               </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-slate-900 truncate">{event.title}</h3>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-2">
                <Calendar size={14} />
                <span>{new Date(event.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                <MapPin size={14} />
                <span className="truncate">{event.location}</span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                 <Link href={`/events/${event.id}`} className="flex-1 text-center text-xs font-bold text-[#581c87] bg-purple-50 py-2 rounded-lg hover:bg-purple-100 transition flex items-center justify-center gap-1">
                    View Page <ExternalLink size={12}/>
                 </Link>
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            You haven't created any events yet.
          </div>
        )}
      </div>
    </div>
  );
}