"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRef } from "react";
import { Search, Filter } from "lucide-react";

export default function SearchFilters() {
    const searchParams = useSearchParams();
    const { replace } = useRouter();
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = (term: string) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams);
            if (term) params.set("q", term);
            else params.delete("q");
            replace(`/events?${params.toString()}`);
        }, 300);
    };

    const handleCategory = (category: string) => {
        const params = new URLSearchParams(searchParams);
        if (category && category !== "All") params.set("category", category);
        else params.delete("category");
        replace(`/events?${params.toString()}`);
    };

    return (
        <div
            className="p-3 rounded-2xl shadow-sm"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Search events..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
                        style={{
                            backgroundColor: "var(--input-bg)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                        }}
                        onChange={(e) => handleSearch(e.target.value)}
                        defaultValue={searchParams.get("q")?.toString()}
                    />
                </div>

                {/* Category */}
                <div className="w-full sm:w-48 relative">
                    <Filter className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                    <select
                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition appearance-none cursor-pointer"
                        style={{
                            backgroundColor: "var(--input-bg)",
                            border: "1px solid var(--input-border)",
                            color: "var(--text-primary)",
                        }}
                        onChange={(e) => handleCategory(e.target.value)}
                        defaultValue={searchParams.get("category")?.toString() ?? "All"}
                    >
                        <option value="All">All Categories</option>
                        <option value="Music">Music</option>
                        <option value="Tech">Tech</option>
                        <option value="Business">Business</option>
                        <option value="Arts">Arts</option>
                        <option value="Food">Food</option>
                        <option value="Nightlife">Nightlife</option>
                        <option value="Others">Others</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
