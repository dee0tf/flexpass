import { Search } from "lucide-react";
import EventCard from "@/components/EventCard";
import { createServerSupabase } from "@/lib/supabase";
import { Event } from "@/lib/types";

export default async function Home() {
  // Debug: Check if Supabase URL is defined
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log("Supabase URL Exists");
  }

  // Debug: Log before fetch
  console.log("Fetching events from Supabase...");

  // Fetch events from Supabase
  const supabase = createServerSupabase();
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true });

  // Debug: Log after fetch
  console.log("Events found:", events);

  // Handle errors
  if (error) {
    console.error("Supabase Error:", error);
  }

  const eventsList: Event[] = events || [];

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-[#F8FAFC] py-12 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-[#0F172A] mb-4 leading-tight">
            Discover & Flex at the Hottest Events in Nigeria.
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Secure your spot for parties, concerts, and tech meetups.
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-xl shadow-sm p-2">
              <input
                type="text"
                placeholder="Search events, artists, venues..."
                className="flex-1 px-4 py-3 text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-flex-purple/20 rounded-lg"
              />
              <button className="bg-gradient-to-b from-[#f97316] to-[#581c87] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Search size={20} />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Event Grid Section */}
      <section className="bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-8">
            Upcoming Events
          </h2>
          
          {eventsList.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No upcoming events found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {eventsList.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
