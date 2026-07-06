import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Calendar, MapPin, ExternalLink } from "lucide-react";
import TicketQR from "@/components/TicketQR";
import TicketActions from "@/components/TicketActions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketPage({ params }: Props) {
  const { id } = await params;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, events(*)")
    .eq("id", id)
    .single();

  if (!ticket) notFound();

  const event = ticket.events;

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-md w-full rounded-3xl shadow-xl overflow-hidden"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-color)" }}>

        {/* Header */}
        <div className="p-8 text-center text-white relative overflow-hidden"
          style={{ backgroundColor: "var(--brand-indigo)" }}>
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-16 w-16 bg-green-400 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">You can Flex now! 🎉</h1>
            <p className="mt-1 opacity-80">Ticket Confirmed</p>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{event.title}</h2>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)" }}>
                {ticket.tier_name || "Standard"}
              </span>
              {ticket.user_gender && (
                <>
                  <span>•</span>
                  <span className="text-xs">{ticket.user_gender}</span>
                </>
              )}
              <span>•</span>
              <span>ID: {ticket.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <Calendar className="h-5 w-5 mt-0.5" style={{ color: "var(--brand-amber)" }} />
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Date</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {new Date(event.date).toDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <MapPin className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--brand-amber)" }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Location</p>
                {!event.location || event.location === "TBA" ? (
                  <p className="text-sm text-orange-500">Venue TBA — host will update soon</p>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{event.location}</p>
                    {event.location_reveal && (
                      <p className="text-xs mt-0.5 font-medium text-green-600">🔓 Unlocked — you have a ticket</p>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Search-on-map link for ticket holders — uses the venue text itself, so
                it works even for venues too small/new to have coordinates on file */}
            {event.location && event.location !== "TBA" && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-9 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium hover:opacity-80 transition"
                style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)" }}>
                <ExternalLink size={13} /> Search on Map
              </a>
            )}
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center py-4">
            <TicketQR ticketId={ticket.id} />
            <p className="text-xs mt-4 font-medium italic" style={{ color: "var(--text-muted)" }}>
              Scan at the entrance to check in
            </p>
          </div>

          {/* Add to Calendar + Share */}
          <TicketActions
            eventTitle={event.title}
            eventDate={event.date}
            eventLocation={event.location}
            eventId={event.id}
          />

          <Link href="/">
            <button className="w-full py-4 rounded-xl font-bold text-white hover:opacity-90 transition mt-2"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
