import EventCard from "@/components/EventCard";
import { createServerSupabase } from "@/lib/supabase";
import { Event } from "@/lib/types";
import Link from "next/link";
import SearchFilters from "@/components/SearchFilters";

export default async function EventsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
    const { q, category } = await searchParams;

    const supabase = createServerSupabase();
    const now = new Date().toISOString();
    let query = supabase.from("events").select("*").gte("date", now).order("date", { ascending: true });

    if (q) query = query.ilike("title", `%${q}%`);
    if (category && category !== "All") query = query.eq("category", category);

    const { data: events } = await query;
    const eventsList: Event[] = events || [];
    const isFiltered = !!(q || (category && category !== "All"));

    return (
        <main className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--background)" }}>
            <div className="max-w-7xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
                        Find Your Next <span style={{ color: "var(--brand-indigo)" }}>Experience</span>
                    </h1>
                    <p className="max-w-2xl mb-6 text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
                        Browse all upcoming concerts, tech summits, and experiences happening across Nigeria.
                    </p>
                    <SearchFilters />
                </header>

                {eventsList.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <p className="text-xl font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
                            No events found{isFiltered ? " matching your search" : ""}.
                        </p>
                        {isFiltered && (
                            <Link
                                href="/events"
                                className="inline-block font-semibold hover:underline text-sm"
                                style={{ color: "var(--brand-indigo)" }}
                            >
                                Clear filters
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {eventsList.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
