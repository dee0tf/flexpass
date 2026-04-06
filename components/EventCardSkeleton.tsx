export default function EventCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
      style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      {/* Image placeholder */}
      <div className="h-48 w-full" style={{ backgroundColor: "var(--surface-raised)" }} />
      <div className="p-5 space-y-3">
        {/* Title */}
        <div className="h-5 rounded-lg w-3/4" style={{ backgroundColor: "var(--surface-raised)" }} />
        {/* Date */}
        <div className="h-4 rounded-lg w-1/2" style={{ backgroundColor: "var(--surface-raised)" }} />
        {/* Location */}
        <div className="h-4 rounded-lg w-2/3" style={{ backgroundColor: "var(--surface-raised)" }} />
        {/* Price + button row */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 rounded-lg w-20" style={{ backgroundColor: "var(--surface-raised)" }} />
          <div className="h-9 rounded-xl w-28" style={{ backgroundColor: "var(--surface-raised)" }} />
        </div>
      </div>
    </div>
  );
}
