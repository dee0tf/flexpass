import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { CheckCircle2, Calendar, MapPin, Ticket as TicketIcon } from "lucide-react";

// Initialize Supabase (Server-side safe)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// FIX: Define params as a Promise for Next.js 15
interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketPage({ params }: Props) {
  // FIX: Await the params to get the ID
  const { id } = await params;

  // 1. Fetch the Ticket AND the Event details
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, events(*)") 
    .eq("id", id) // Use the unwrapped ID
    .single();

  if (!ticket) {
    return <div className="p-10 text-center text-red-500 font-bold">Ticket not found in database.</div>;
  }

  const event = ticket.events;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Header Section */}
        <div className="bg-[#581c87] p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-16 w-16 bg-green-400 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <CheckCircle2 className="h-8 w-8 text-[#581c87]" />
            </div>
            <h1 className="text-2xl font-bold">You can Flex now 🎉!</h1>
            <p className="text-purple-200 mt-1">Ticket Confirmed</p>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900">{event.title}</h2>
            <div className="flex items-center justify-center gap-2 mt-2 text-slate-500 text-sm">
                <span className="bg-slate-100 px-3 py-1 rounded-full">{ticket.status.toUpperCase()}</span>
                <span>•</span>
                <span>ID: {ticket.id.slice(0, 8)}</span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-start gap-4">
              <Calendar className="h-5 w-5 text-[#f97316] mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Date</p>
                <p className="text-slate-500 text-sm">{new Date(event.date).toDateString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="h-5 w-5 text-[#f97316] mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Location</p>
                <p className="text-slate-500 text-sm">{event.location}</p>
              </div>
            </div>
          </div>

          {/* QR Code Placeholder */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center">
             <TicketIcon className="h-12 w-12 text-slate-300 mb-2" />
             <p className="text-xs text-slate-400">Show this at the entrance</p>
          </div>

          <Link href="/">
            <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-4 hover:bg-slate-800 transition">
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}