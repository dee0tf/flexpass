import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#0F172A] mb-4">Event Not Found</h1>
        <p className="text-gray-600 mb-8">
          The event you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/"
          className="bg-gradient-to-b from-[#f97316] to-[#581c87] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity inline-block"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

