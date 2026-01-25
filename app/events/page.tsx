import EventCard from "@/components/EventCard";
import { createServerSupabase } from "@/lib/supabase";
import { Event } from "@/lib/types";

import SearchFilters from "@/components/SearchFilters";

export default async function EventsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
    const { q, category } = await searchParams;

    const supabase = createServerSupabase();
    let query = supabase.from("events").select("*").order("date", { ascending: true });

    if (q) {
        query = query.ilike("title", `%${q}%`);
    }

    if (category && category !== "All") {
        query = query.eq("category", category);
    }

    const { data: events, error } = await query;

    if (error) {
        console.error("Supabase Error:", error);
    }

    const eventsList: Event[] = events || [];

    return (
        <main className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] mb-4">
                        Find Your Next <span className="text-flex-purple">Experience</span>
                    </h1>
                    <p className="text-gray-600 max-w-2xl mb-8">
                        Browse through all upcoming parties, concerts, and tech meetups happening in Nigeria.
                    </p>

                    <SearchFilters />
                </header>

                {eventsList.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <p className="text-xl text-gray-500 font-medium">No events found matching your criteria.</p>
                        <button className="mt-4 text-[#581c87] font-medium hover:underline">
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {eventsList.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
