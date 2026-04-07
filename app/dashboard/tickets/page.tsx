"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Ticket, Calendar, MapPin, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadTickets() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      let email = user?.email ?? null;
      setUserEmail(email);

      if (!email) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("tickets")
        .select("*, events(title, date, location, image_url)")
        .eq("user_email", email)
        .eq("status", "valid")
        .order("created_at", { ascending: false });

      setTickets(data || []);
      setLoading(false);
    }
    loadTickets();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-[#480082]" />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">Please log in to view your tickets.</p>
        <Link
          href="/login"
          className="inline-flex px-6 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition"
          style={{ backgroundColor: "var(--brand-indigo)" }}
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme">My Tickets</h1>
        <p className="text-theme-2 mt-1">All tickets purchased with <strong>{userEmail}</strong></p>
      </div>

      {tickets.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 rounded-2xl"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <Inbox className="h-12 w-12 mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
            No tickets yet
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Tickets you purchase will appear here.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition"
            style={{ backgroundColor: "var(--brand-indigo)" }}
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tickets.map((ticket) => {
            const event = ticket.events;
            const eventDate = event?.date ? new Date(event.date) : null;
            const isPast = eventDate ? eventDate < new Date() : false;

            return (
              <div
                key={ticket.id}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
              >
                {/* Event image strip */}
                <div className="h-28 bg-slate-100 relative">
                  {event?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: isPast ? "rgba(100,100,100,0.8)" : "rgba(72,0,130,0.85)",
                        color: "#fff",
                      }}
                    >
                      {ticket.tier_name || "Standard"}
                    </span>
                  </div>
                  {isPast && (
                    <div className="absolute top-3 right-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-500/80 text-white">
                        Past Event
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-base mb-3 leading-snug" style={{ color: "var(--text-primary)" }}>
                    {event?.title || "Event"}
                  </h3>

                  <div className="space-y-2 mb-4">
                    {eventDate && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--brand-amber)" }} />
                        {eventDate.toDateString()}
                      </div>
                    )}
                    {event?.location && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--brand-amber)" }} />
                        {event.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <Ticket className="h-4 w-4 shrink-0" style={{ color: "var(--brand-indigo)" }} />
                      ID: {ticket.id.slice(0, 8).toUpperCase()}
                    </div>
                  </div>

                  <div className="mt-auto pt-3" style={{ borderTop: "1px solid var(--card-border)" }}>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm transition hover:opacity-90"
                      style={{ backgroundColor: "var(--brand-indigo)", color: "#fff" }}
                    >
                      <ExternalLink size={14} /> View Ticket & QR Code
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
