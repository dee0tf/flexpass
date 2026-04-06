"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Calendar, MapPin, ExternalLink, Copy, Check, Edit } from "lucide-react";

export default function MyEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicated, setDuplicated] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadEvents();
  }, []);

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

  async function handleDuplicate(eventId: string) {
    setDuplicating(eventId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/duplicate-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();
      if (res.ok && data.newEventId) {
        setDuplicated(eventId);
        setTimeout(() => setDuplicated(null), 2000);
        await loadEvents(); // refresh list
        router.push(`/dashboard/events/${data.newEventId}/edit`);
      } else {
        alert(data.error || "Failed to duplicate event");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setDuplicating(null);
    }
  }

  if (loading) return <div className="p-10"><Loader2 className="animate-spin text-[#480082]" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme">My Events</h1>
          <p className="text-theme-2 text-sm mt-1">{events.length} event{events.length !== 1 ? "s" : ""} created</p>
        </div>
        <Link href="/create">
          <button className="bg-[#480082] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#3a006b] transition">
            + New Event
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="h-32 bg-slate-100 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {event.image_url && <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />}
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold text-[#480082]">
                ₦{(event.price ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-theme truncate">{event.title}</h3>
              <div className="flex items-center gap-2 text-theme-2 text-sm mt-2">
                <Calendar size={14} />
                <span>{new Date(event.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-theme-2 text-sm mt-1">
                <MapPin size={14} />
                <span className="truncate">{event.location}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                <Link
                  href={`/events/${event.id}`}
                  className="flex-1 text-center text-xs font-bold text-[#480082] bg-[#480082]/5 py-2 rounded-lg hover:bg-[#480082]/10 transition flex items-center justify-center gap-1"
                >
                  <ExternalLink size={12} /> View
                </Link>
                <Link
                  href={`/dashboard/events/${event.id}/edit`}
                  className="flex-1 text-center text-xs font-bold text-slate-600 bg-slate-100 py-2 rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-1"
                >
                  <Edit size={12} /> Edit
                </Link>
                <button
                  onClick={() => handleDuplicate(event.id)}
                  disabled={duplicating === event.id}
                  className="flex-1 text-xs font-bold text-slate-600 bg-slate-100 py-2 rounded-lg hover:bg-slate-200 transition flex items-center justify-center gap-1 disabled:opacity-60"
                >
                  {duplicating === event.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : duplicated === event.id ? (
                    <><Check size={12} className="text-green-500" /> Done</>
                  ) : (
                    <><Copy size={12} /> Copy</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            You haven&apos;t created any events yet.
          </div>
        )}
      </div>
    </div>
  );
}
