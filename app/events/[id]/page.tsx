import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, MapPin, Clock } from "lucide-react";
import ClientEventPage from "./ClientEventPage";

import { Metadata } from "next";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getEvent(id: string) {
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) return null;

  // Fetch tiers
  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", id)
    .order('price', { ascending: true });

  // Count sold tickets per tier so buyers can see remaining
  const { data: soldRows } = await supabase
    .from("tickets")
    .select("tier_id")
    .eq("event_id", id)
    .eq("status", "valid");

  const soldByTier: Record<string, number> = {};
  for (const row of soldRows || []) {
    const key = row.tier_id ?? "__legacy__";
    soldByTier[key] = (soldByTier[key] || 0) + 1;
  }

  const tiersWithRemaining = (tiers || []).map((t: any) => ({
    ...t,
    remaining: Math.max(0, t.quantity_available - (soldByTier[t.id] || 0)),
  }));

  // For legacy (no-tier) events
  const legacySold = soldByTier["__legacy__"] || 0;
  const legacyRemaining = Math.max(0, (event.total_tickets || 0) - legacySold);

  return { ...event, tiers: tiersWithRemaining, legacyRemaining };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    return {
      title: "Event Not Found - FlexPass",
    };
  }

  return {
    title: `${event.title} - FlexPass Nigeria`,
    description: event.description?.slice(0, 160) || `Buy tickets for ${event.title} on FlexPass.`,
    openGraph: {
      title: event.title,
      description: event.description?.slice(0, 160),
      images: [
        {
          url: event.image_url || "/placeholder.jpg",
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description: event.description?.slice(0, 160),
      images: [event.image_url || "/placeholder.jpg"],
    },
  };
}

// FIX: params is defined as a Promise now
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  // FIX: We must await params before using the ID
  const { id } = await params;

  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  // Format Date
  const dateObj = new Date(event.date);
  const dateString = dateObj.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeString = dateObj.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 w-full">
        <Image
          src={event.image_url || "/placeholder.jpg"}
          alt={event.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
      </div>

      {/* Content Container */}
      <div className="max-w-3xl mx-auto px-6 -mt-16 relative z-10">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{event.title}</h1>

          <div className="flex flex-col gap-3 mt-4 text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#480082]" />
              <span>{dateString}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#480082]" />
              <span>{timeString}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#480082]" />
              <span>{event.location}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">About this Event</h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
            {event.description}
          </p>
        </div>
      </div>

      {/* Checkout Button */}
      <ClientEventPage
        eventTitle={event.title}
        eventPrice={event.price}
        eventId={event.id}
        eventDate={event.date}
        tiers={event.tiers}
        legacyRemaining={event.legacyRemaining}
      />
    </div>
  );
}