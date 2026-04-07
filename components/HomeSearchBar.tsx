"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function HomeSearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/events?q=${encodeURIComponent(query)}`);
    } else {
        router.push("/events");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form 
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-2"
      >
        <input
          type="text"
          placeholder="Search events, artists, venues..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-3 text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-flex-purple/20 rounded-lg bg-transparent"
        />
        <button 
          type="submit"
          className="bg-[#480082] hover:bg-[#3a006b] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Search size={20} />
          <span>Search</span>
        </button>
      </form>
    </div>
  );
}
