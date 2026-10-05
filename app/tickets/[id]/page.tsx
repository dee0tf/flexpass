import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Calendar, Clock, MapPin, ExternalLink, Sun } from "lucide-react";
import TicketQR from "@/components/TicketQR";
import TicketActions from "@/components/TicketActions";
import DropText from "@/components/DropText";
import { genderMark } from "@/lib/gender";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  params: Promise<{ id: string }>;
}

// events.date is stored as midnight UTC of the event day, so format it in
// UTC — formatting in local time can shift it to the day before.
function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(date));
}

// start_time is a plain "HH:MM" (24h) string from the event form.
function formatStartTime(startTime?: string | null) {
  const m = startTime?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

// Days from today (in Lagos) to the event day.
function countdownLabel(date: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const days = Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  if (days < 0) return "Past event";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// Ambient sparkles behind the ticket — fixed positions so server and client agree.
const SPARKLES = [
  { top: "12%", left: "10%", size: 6, delay: 0 },
  { top: "22%", left: "86%", size: 4, delay: 700 },
  { top: "48%", left: "6%", size: 5, delay: 1400 },
  { top: "64%", left: "92%", size: 6, delay: 400 },
  { top: "82%", left: "14%", size: 4, delay: 1100 },
  { top: "6%", left: "58%", size: 4, delay: 1800 },
];

export default async function TicketPage({ params }: Props) {
  const { id } = await params;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, events(*)")
    .eq("id", id)
    .single();

  if (!ticket) notFound();

  const event = ticket.events;
  const time = formatStartTime(event.start_time);
  const shortCode = ticket.id.slice(0, 8).toUpperCase();
  const checkedIn = ticket.status === "scanned";
  const hasVenue = !!event.location && event.location !== "TBA";
  // Some events price tickets by gender, so door staff need to see it at a glance.
  const gender = genderMark(ticket.user_gender);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 flex justify-center"
      style={{ backgroundColor: "var(--background)" }}>

      {/* Ambient glow + sparkles */}
      <div className="fp-orb pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(123,63,204,0.45), transparent 65%)" }} aria-hidden />
      <div className="fp-orb pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,183,0,0.22), transparent 65%)", animationDelay: "-4s" }} aria-hidden />
      {SPARKLES.map((s, i) => (
        <span key={i} className="fp-twinkle pointer-events-none absolute rounded-full"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, backgroundColor: "var(--brand-amber)", animationDelay: `${s.delay}ms` }}
          aria-hidden />
      ))}

      <div className="relative w-full max-w-md flex flex-col gap-6">

        {/* Celebration header */}
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className="fp-pop flex h-14 w-14 items-center justify-center rounded-full bg-green-400 text-white">
            <Check className="h-7 w-7" strokeWidth={3} />
          </div>
          <h1 className="font-display text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            <DropText text="You can Flex now!" delay={250} stagger={40}
              highlight={{ words: ["Flex"], color: "var(--brand-amber)" }} />
          </h1>
          <p className="fp-fade-up text-sm" style={{ color: "var(--text-secondary)", animationDelay: "950ms" }}>
            Ticket confirmed — see you there
          </p>
        </div>

        {/* The ticket */}
        <div className="fp-rise relative rounded-[28px] text-white"
          style={{
            animationDelay: "350ms",
            background: "linear-gradient(160deg, #9F67FE 0%, #6A23B8 45%, #480082 100%)",
            boxShadow: "0 30px 70px rgba(72,0,130,0.45)",
          }}>

          <div className="p-6 flex flex-col gap-4">
            <div className="fp-fade-up flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.14em]"
              style={{ animationDelay: "650ms" }}>
              <span className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.16)" }}>
                {ticket.tier_name || "Standard"}
              </span>
              {checkedIn ? (
                <span className="rounded-full bg-green-400 px-3 py-1 text-green-950">Checked in</span>
              ) : (
                <span className="rounded-full px-3 py-1" style={{ backgroundColor: "var(--brand-amber)", color: "#1A0F00" }}>
                  {countdownLabel(event.date)}
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-[28px] font-bold leading-[1.05] min-w-0">
                <DropText text={event.title} delay={800} stagger={28} />
              </h2>
              {gender && (
                <div className="fp-pop shrink-0 flex flex-col items-center gap-1" style={{ animationDelay: "1000ms" }}
                  aria-label={`Gender: ${gender.word}`}>
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white font-display text-6xl font-bold leading-none shadow-lg"
                    style={{ color: gender.color }}>
                    {gender.letter}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {gender.word}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
              <div className="fp-fade-up flex items-center gap-3" style={{ animationDelay: "1200ms" }}>
                <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--brand-amber)" }} />
                <span>{formatEventDate(event.date)}</span>
              </div>
              {time && (
                <div className="fp-fade-up flex items-center gap-3" style={{ animationDelay: "1300ms" }}>
                  <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--brand-amber)" }} />
                  <span>{time}</span>
                </div>
              )}
              <div className="fp-fade-up flex items-start gap-3" style={{ animationDelay: "1400ms" }}>
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--brand-amber)" }} />
                {hasVenue ? (
                  <span className="min-w-0">
                    {event.location}
                    {event.location_reveal && (
                      <span className="block text-xs mt-0.5 font-semibold text-green-300">Unlocked — you have a ticket</span>
                    )}
                  </span>
                ) : (
                  <span>Venue TBA — the host will update soon</span>
                )}
              </div>
            </div>

            {ticket.user_name && (
              <div className="fp-fade-up text-xs uppercase tracking-[0.14em]"
                style={{ color: "rgba(255,255,255,0.7)", animationDelay: "1500ms" }}>
                Admit · <span className="font-bold text-white normal-case tracking-normal text-sm">{ticket.user_name}</span>
              </div>
            )}
          </div>

          {/* Tear line with notches cut out of the ticket */}
          <div className="relative mx-6 border-t-2 border-dashed" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
            <span className="absolute -left-[38px] -top-[15px] h-7 w-7 rounded-full" style={{ backgroundColor: "var(--background)" }} aria-hidden />
            <span className="absolute -right-[38px] -top-[15px] h-7 w-7 rounded-full" style={{ backgroundColor: "var(--background)" }} aria-hidden />
          </div>

          {/* Stub */}
          <div className="p-6 flex flex-col items-center gap-4">
            <TicketQR ticketId={ticket.id} revealDelay={1500} />
            <div className="font-mono text-lg font-bold tracking-[0.3em]">
              <DropText text={shortCode} delay={2300} stagger={55} />
            </div>
            <p className="fp-fade-up text-xs" style={{ color: "rgba(255,255,255,0.8)", animationDelay: "2700ms" }}>
              Show this at the door to check in
            </p>
          </div>
        </div>

        <div className="fp-fade-up flex flex-col gap-3" style={{ animationDelay: "2600ms" }}>
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ backgroundColor: "rgba(255,183,0,0.08)", border: "1px solid rgba(255,183,0,0.2)" }}>
            <Sun size={14} className="mt-0.5 shrink-0" style={{ color: "var(--brand-amber)" }} />
            <p style={{ color: "var(--text-secondary)" }}>
              Turn your screen brightness all the way up and tilt it away from glare before scanning — that&apos;s the #1 reason a good QR code fails to scan.
            </p>
          </div>

          {/* Search-on-map link for ticket holders — uses the venue text itself, so
              it works even for venues too small/new to have coordinates on file */}
          {hasVenue && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold hover:opacity-80 transition"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--border-color)" }}>
              <ExternalLink size={14} /> Open in Maps
            </a>
          )}

          {/* Add to Calendar + Share */}
          <TicketActions
            eventTitle={event.title}
            eventDate={event.date}
            eventLocation={event.location}
            eventId={event.id}
          />

          <Link href="/"
            className="w-full py-4 rounded-xl font-bold text-white text-center hover:opacity-90 transition"
            style={{ backgroundColor: "var(--brand-indigo)" }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
