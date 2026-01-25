import { Search } from "lucide-react";
import EventCard from "@/components/EventCard";
import { createServerSupabase } from "@/lib/supabase";
import { Event } from "@/lib/types";
import Logo from "@/components/Logo";

export default async function Home() {
  // Fetch events from Supabase
  const supabase = createServerSupabase();
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true });

  // Handle errors
  if (error) {
    console.error("Supabase Error:", error);
  }

  const eventsList: Event[] = events || [];

  return (
    <main className="min-h-screen">
      {/* Hero Section with Video Background */}
      <section className="relative py-12 md:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-background.mp4" type="video/mp4" />
        </video>

        {/* Dark Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#0F172A]"></div>

        {/* Logo Watermark in Background - Bringing out the best of it */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.15] pointer-events-none overflow-hidden">
          <div className="animate-float motion-safe:scale-110">
            <Logo type="icon" size={800} className="filter blur-[2px] md:blur-none" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-[1.1] drop-shadow-2xl">
            Discover & Flex at the <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-[#f97316] to-[#581c87] bg-clip-text text-transparent">
              Hottest Events
            </span> in Nigeria.
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto font-medium tracking-wide drop-shadow-lg">
            Secure your spot for parties, concerts, and tech meetups.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-2">
              <input
                type="text"
                placeholder="Search events, artists, venues..."
                className="flex-1 px-4 py-3 text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-flex-purple/20 rounded-lg bg-transparent"
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
