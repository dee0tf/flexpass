"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Calendar, MapPin, Clock, BadgeCheck } from "lucide-react";
import { Event } from "@/lib/types";

interface EventCardProps {
  event: Event;
  variant?: "default" | "featured";
  priority?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Music:     { bg: "rgba(159,103,254,0.15)", text: "#9F67FE" },
  Tech:      { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  Business:  { bg: "rgba(255,183,0,0.15)",   text: "#d97706" },
  Arts:      { bg: "rgba(236,72,153,0.15)",  text: "#ec4899" },
  Food:      { bg: "rgba(34,197,94,0.15)",   text: "#16a34a" },
  Nightlife: { bg: "rgba(14,13,13,0.7)",     text: "#f0eef8" },
  Others:    { bg: "rgba(100,116,139,0.15)", text: "#64748b" },
};

export default function EventCard({ event, variant = "default", priority = false }: EventCardProps) {
  const [imgError, setImgError] = useState(false);
  const eventDate = new Date(event.date);

  // Computed client-side only to avoid SSR/hydration mismatch with new Date()
  const [isEnded, setIsEnded] = useState(false);
  const [isSoon, setIsSoon] = useState(false);

  useEffect(() => {
    const now = new Date();
    // Always slice to YYYY-MM-DD so Supabase timestamp formats (e.g. "2026-06-27T00:00:00+00:00")
    // don't get parsed as UTC midnight — treat the event as active until end of local day.
    const cmpDate = new Date(event.date.slice(0, 10) + "T23:59:59");
    const ended = cmpDate < now;
    setIsEnded(ended);
    setIsSoon(!ended && (cmpDate.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000);
  }, [event.date]);

  const cat = CATEGORY_COLORS[event.category || "Others"] ?? CATEGORY_COLORS.Others;

  return (
    <Link href={`/events/${event.id}`} className="block group">
      <div
        className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
          isEnded ? "opacity-60" : "hover:-translate-y-1"
        }`}
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
          boxShadow: isEnded ? "none" : "0 4px 24px var(--card-shadow)",
        }}
      >
        {/* Image */}
        <div className={`relative overflow-hidden ${variant === "featured" ? "h-52" : "h-44"}`}>
          {event.image_url && !imgError ? (
            <Image
              src={event.image_url}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              priority={priority}
              className={`object-cover transition-transform duration-500 ${
                isEnded ? "grayscale" : "group-hover:scale-105"
              }`}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full grad-brand flex items-center justify-center">
              <span className="text-5xl opacity-30">🎟</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            {event.category && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm"
                style={{ backgroundColor: cat.bg, color: cat.text }}
              >
                {event.category}
              </span>
            )}
            {isEnded && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm">
                Ended
              </span>
            )}
            {isSoon && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--brand-amber)", color: "#0E0D0D" }}>
                Soon
              </span>
            )}
            {event.organizer_verified && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm"
                style={{ backgroundColor: "rgba(22,163,74,0.15)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.35)" }}>
                <BadgeCheck size={11} /> Verified
              </span>
            )}
          </div>

          {/* Price */}
          <div className="absolute bottom-3 right-3">
            <span className="text-sm font-bold px-3 py-1 rounded-full text-white shadow-lg"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              {event.price === 0 ? "Free" : `₦${event.price.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="p-4">
          <h3
            className="font-display font-semibold text-base leading-snug mb-3 line-clamp-2 transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            {event.title}
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Calendar size={13} className="shrink-0" style={{ color: "var(--brand-lavender)" }} />
              <span>{eventDate.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            {event.start_time && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <Clock size={13} className="shrink-0" style={{ color: "var(--brand-lavender)" }} />
                <span>{event.start_time}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <MapPin size={13} className="shrink-0" style={{ color: "var(--brand-lavender)" }} />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
