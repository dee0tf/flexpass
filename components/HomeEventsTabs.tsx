"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import EventCard from "@/components/EventCard";
import { Event } from "@/lib/types";

type Tab = "upcoming" | "concluded";

export default function HomeEventsTabs({
  upcoming,
  concluded,
}: {
  upcoming: Event[];
  concluded: Event[];
}) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const list = tab === "upcoming" ? upcoming : concluded;

  return (
    <section className="bg-[#F9F8FF] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: "#6B32A8" }}>
              {tab === "upcoming" ? "Don't Miss Out" : "Take a Look Back"}
            </p>
            <h2 className="font-display text-3xl font-bold text-[#0E0D0D]">
              {tab === "upcoming" ? "Upcoming Events" : "Concluded Events"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex rounded-full bg-white border border-[#eDdedd] p-1">
              <button
                onClick={() => setTab("upcoming")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  tab === "upcoming" ? "bg-[#480082] text-white" : "text-[#480082]/60 hover:text-[#480082]"
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setTab("concluded")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  tab === "concluded" ? "bg-[#480082] text-white" : "text-[#480082]/60 hover:text-[#480082]"
                }`}
              >
                Concluded
              </button>
            </div>

            {tab === "upcoming" && (
              <Link href="/events" className="hidden sm:flex items-center gap-1 text-[#480082] hover:text-[#9F67FE] text-sm font-medium transition-colors">
                View all <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#eDdedd]">
            {tab === "upcoming" ? (
              <>
                <p className="text-[#480082]/50 font-display text-xl">No upcoming events yet.</p>
                <Link href="/create" className="mt-4 inline-block text-[#480082] font-medium hover:underline">
                  Be the first to host one →
                </Link>
              </>
            ) : (
              <p className="text-[#480082]/50 font-display text-xl">No concluded events yet.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {list.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
