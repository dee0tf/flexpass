"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Search, Filter, MapPin, Loader2, X } from "lucide-react";

export default function SearchFilters() {
    const searchParams = useSearchParams();
    const { replace } = useRouter();
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const [locating, setLocating] = useState(false);
    const [locError, setLocError] = useState("");

    const activeCity = searchParams.get("city");

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

    const handleNearMe = () => {
        setLocError("");
        if (!navigator.geolocation) { setLocError("Geolocation not supported by your browser"); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
                        { headers: { "Accept-Language": "en" } }
                    );
                    const data = await res.json();
                    const city = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state;
                    if (city) {
                        const params = new URLSearchParams(searchParams);
                        params.set("city", city);
                        replace(`/events?${params.toString()}`);
                    } else {
                        setLocError("Could not detect your city");
                    }
                } catch {
                    setLocError("Location lookup failed");
                } finally {
                    setLocating(false);
                }
            },
            () => { setLocError("Location access denied"); setLocating(false); },
            { timeout: 8000 }
        );
    };

    const clearCity = () => {
        const params = new URLSearchParams(searchParams);
        params.delete("city");
        replace(`/events?${params.toString()}`);
    };

    return (
        <div className="space-y-2">
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

                    {/* Near Me */}
                    <button
                        onClick={handleNearMe}
                        disabled={locating}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
                        style={activeCity
                            ? { backgroundColor: "var(--brand-indigo)", color: "#fff", border: "1px solid var(--brand-indigo)" }
                            : { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-secondary)" }
                        }
                    >
                        {locating
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MapPin className="h-4 w-4" />
                        }
                        {activeCity ? activeCity : "Near Me"}
                    </button>
                </div>
            </div>

            {/* Active city chip */}
            {activeCity && (
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
                        <MapPin size={11} /> Showing events near {activeCity}
                    </span>
                    <button onClick={clearCity} className="text-xs flex items-center gap-1 hover:underline"
                        style={{ color: "var(--text-muted)" }}>
                        <X size={11} /> Clear
                    </button>
                </div>
            )}

            {locError && (
                <p className="text-xs text-red-500 flex items-center gap-1 px-1">{locError}</p>
            )}
        </div>
    );
}
