import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, MapPin, Clock, Lock, ExternalLink, BadgeCheck } from "lucide-react";
import ClientEventPage from "./ClientEventPage";
import CountdownTimer from "@/components/CountdownTimer";

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

  // Fetch tiers — hidden/giveaway tiers are excluded at the query level
  // (not just filtered out of rendering) so their data never enters the
  // page's fetch payload at all. Next.js embeds raw fetch responses in the
  // RSC hydration stream for cache bookkeeping, so filtering only after the
  // fact would still leak a hidden tier's name/price/quantity into page
  // source even though it's correctly excluded from what's rendered.
  const { data: tiers } = await supabase
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", id)
    .eq("is_hidden", false)
    .order('price', { ascending: true });

  // Count sold tickets per tier so buyers can see remaining. Includes
  // 'scanned' as well as 'valid' — a checked-in ticket still occupies a
  // slot and must keep counting, or remaining capacity appears to free up
  // as attendees check in mid-event.
  //
  // Uses a head-count query per tier (not a row fetch) because Supabase/
  // PostgREST caps a plain select's rows at 1000 by default — a row fetch
  // would silently truncate the sold count on any tier that's sold past
  // that, understating how many are sold and overstating "remaining".
  const soldByTier: Record<string, number> = {};
  await Promise.all(
    (tiers || []).map(async (t: any) => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .eq("tier_id", t.id)
        .in("status", ["valid", "scanned"]);
      soldByTier[t.id] = count || 0;
    })
  );
  {
    const { count: legacyCount } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .is("tier_id", null)
      .in("status", ["valid", "scanned"]);
    soldByTier["__legacy__"] = legacyCount || 0;
  }

  const tiersWithRemaining = (tiers || [])
    // Hidden/giveaway tiers are never shown or purchasable on the public
    // page — tickets against them are issued directly by the host instead.
    .filter((t: any) => !t.is_hidden)
    .map((t: any) => {
      // soldByTier counts individual ticket rows; quantity_available counts
      // groups/units for group tiers (group_size > 1), so convert back to the
      // same unit before comparing — otherwise a group tier reads as sold out
      // as soon as individual-ticket count passes the group count.
      const groupSize = t.group_size || 1;
      const groupsSold = (soldByTier[t.id] || 0) / groupSize;
      return { ...t, remaining: Math.max(0, t.quantity_available - groupsSold) };
    });

  // For legacy (no-tier) events
  const legacySold = soldByTier["__legacy__"] || 0;
  const legacyRemaining = Math.max(0, (event.total_tickets || 0) - legacySold);

  return { ...event, tiers: tiersWithRemaining, legacyRemaining };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    return { title: "Event Not Found" };
  }

  const description = event.description?.slice(0, 160) || `Buy tickets for ${event.title} on FlexPass.`;

  return {
    title: event.title,
    description,
    alternates: {
      canonical: `/events/${id}`,
    },
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "FlexPass",
      url: `/events/${id}`,
      title: `${event.title} — FlexPass`,
      description,
      images: event.image_url
        ? [{ url: event.image_url, width: 1200, height: 630, alt: event.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.title} — FlexPass`,
      description,
      site: "@flexpasshq",
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

// FIX: params is defined as a Promise now
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

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

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `Event: ${event.title}`,
    startDate: event.date,
    url: `https://www.flexpasshq.com/events/${id}`,
    image: event.image_url || "https://www.flexpasshq.com/opengraph-image",
    location: {
      "@type": "Place",
      name: event.location,
      address: { "@type": "PostalAddress", addressLocality: event.location, addressCountry: "NG" },
    },
    organizer: { "@type": "Organization", name: "FlexPass", url: "https://www.flexpasshq.com" },
    offers:
      event.tiers?.length > 0
        ? event.tiers.map((tier: any) => ({
            "@type": "Offer",
            name: tier.name,
            price: String(tier.price),
            priceCurrency: "NGN",
            url: `https://www.flexpasshq.com/events/${id}`,
            availability:
              tier.remaining > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            validFrom: new Date().toISOString(),
          }))
        : [
            {
              "@type": "Offer",
              price: String(event.price),
              priceCurrency: "NGN",
              url: `https://www.flexpasshq.com/events/${id}`,
              availability:
                event.legacyRemaining > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/SoldOut",
              validFrom: new Date().toISOString(),
            },
          ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
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
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{event.title}</h1>
            {event.organizer_verified && (
              <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                <BadgeCheck size={13} /> Verified Organiser
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-4 text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#480082]" />
              <span>{dateString}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#480082]" />
              <span>{timeString}</span>
            </div>
            {event.location_reveal ? (
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#480082]" />
                <span className="text-sm font-medium text-slate-500 italic">Location revealed after purchase</span>
              </div>
            ) : !event.location || event.location === "TBA" ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-slate-400" />
                <span className="text-slate-400 italic">Venue to be announced</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#480082]" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Search-on-map link — uses the venue text itself, so it works even for
              venues too small/new to have coordinates on file */}
          {!event.location_reveal && event.location && event.location !== "TBA" && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-[#480082] hover:bg-slate-100 transition bg-slate-50 border border-slate-100"
            >
              <ExternalLink size={13} /> Search on Map
            </a>
          )}

          {/* Hidden location reveal card */}
          {event.location_reveal && (
            <div className="mt-5 rounded-2xl p-4 flex items-center gap-3 bg-slate-50 border border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-[#480082]/10 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-[#480082]" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Location Revealed After Purchase</p>
                <p className="text-xs text-slate-500 mt-0.5">Buy your ticket to unlock the exact venue and get directions.</p>
              </div>
            </div>
          )}

          {/* Countdown timer — visible within 7 days of the event */}
          <CountdownTimer eventDate={event.date} />
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
        salesEndDate={event.sales_end_date}
        tiers={event.tiers}
        legacyRemaining={event.legacyRemaining}
      />
    </div>
    </>
  );
}