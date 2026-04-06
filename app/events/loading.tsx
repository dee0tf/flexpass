import EventCardSkeleton from "@/components/EventCardSkeleton";

export default function EventsLoading() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <div className="h-10 w-80 rounded-xl animate-pulse mb-4" style={{ backgroundColor: "var(--surface-raised)" }} />
          <div className="h-5 w-96 rounded-lg animate-pulse mb-8" style={{ backgroundColor: "var(--surface-raised)" }} />
          {/* Search bar skeleton */}
          <div className="rounded-2xl p-4 animate-pulse" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 h-12 rounded-xl" style={{ backgroundColor: "var(--surface-raised)" }} />
              <div className="w-full md:w-48 h-12 rounded-xl" style={{ backgroundColor: "var(--surface-raised)" }} />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
