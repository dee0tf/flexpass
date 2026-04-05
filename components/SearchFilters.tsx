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
            if (term) {
                params.set("q", term);
            } else {
                params.delete("q");
            }
            replace(`/events?${params.toString()}`);
        }, 300); // Debounce for 300ms
    };

    const handleCategory = (category: string) => {
        const params = new URLSearchParams(searchParams);
        if (category && category !== "All") {
            params.set("category", category);
        } else {
            params.delete("category");
        }
        replace(`/events?${params.toString()}`);
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none"
                        onChange={(e) => handleSearch(e.target.value)}
                        defaultValue={searchParams.get("q")?.toString()}
                    />
                </div>

                {/* Category Filter */}
                <div className="w-full md:w-48 relative">
                    <Filter className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 pointer-events-none" />
                    <select
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#581c87] focus:outline-none bg-white appearance-none cursor-pointer"
                        onChange={(e) => handleCategory(e.target.value)}
                        defaultValue={searchParams.get("category")?.toString()}
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
