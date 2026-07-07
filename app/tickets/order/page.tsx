import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Ticket, ArrowRight } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  searchParams: Promise<{ ids?: string }>;
}

export default async function OrderConfirmationPage({ searchParams }: Props) {
  const { ids } = await searchParams;
  const ticketIds = (ids || "").split(",").map(s => s.trim()).filter(Boolean);

  if (ticketIds.length === 0) notFound();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, tier_name, event_id, events(title)")
    .in("id", ticketIds);

  if (!tickets || tickets.length === 0) notFound();

  // Preserve the order tickets were created in, not whatever order the DB returns
  const ordered = ticketIds
    .map(id => tickets.find(t => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const event = ordered[0]?.events as unknown as { title: string } | undefined;

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
            <p className="mt-1 opacity-80">{ordered.length} Tickets Confirmed</p>
          </div>
        </div>

        {/* Tickets */}
        <div className="p-6 space-y-4">
          {event && (
            <h2 className="text-xl font-bold text-center" style={{ color: "var(--text-primary)" }}>{event.title}</h2>
          )}
          <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
            Each ticket below has its own QR code — open the right one for each person joining you.
          </p>

          <div className="space-y-3 pt-2">
            {ordered.map((ticket, i) => (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-4 rounded-xl transition hover:opacity-80"
                style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(72,0,130,0.12)" }}>
                    <Ticket className="h-5 w-5" style={{ color: "var(--brand-indigo)" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      Ticket {i + 1} of {ordered.length}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {ticket.tier_name || "Standard"} &middot; ID: {ticket.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>

          <Link href="/">
            <button className="w-full py-4 rounded-xl font-bold text-white hover:opacity-90 transition mt-4"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
