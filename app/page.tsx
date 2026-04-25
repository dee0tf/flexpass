import EventCard from "@/components/EventCard";
import { createServerSupabase } from "@/lib/supabase";
import HomeSearchBar from "@/components/HomeSearchBar";
import { Event } from "@/lib/types";
import Link from "next/link";
import { ArrowRight, Zap, ShieldCheck, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Music", "Tech", "Business", "Arts", "Food", "Nightlife", "Others"];

const CATEGORY_ICONS: Record<string, string> = {
  Music: "🎵", Tech: "💻", Business: "💼",
  Arts: "🎨", Food: "🍜", Nightlife: "🌙", Others: "✦",
};

export default async function Home() {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("date", now.split("T")[0])          // only upcoming
    .order("date", { ascending: true })
    .limit(9);

  const { data: featuredEvents } = await supabase
    .from("events")
    .select("*")
    .gte("date", now.split("T")[0])
    .order("created_at", { ascending: false })
    .limit(3);

  const upcomingList: Event[] = events || [];
  const featured: Event[] = featuredEvents || [];

  return (
    <main className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden pt-16">
        {/* Video background */}
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-background.mp4" type="video/mp4" />
        </video>

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E0D0D]/80 via-[#480082]/40 to-[#0E0D0D]" />

        {/* Brand pattern overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle, #9F67FE 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full py-20">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[#FFB700]/10 border border-[#FFB700]/30 text-[#FFB700] rounded-full px-4 py-1.5 text-sm font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFB700] animate-pulse" />
            Nigeria&apos;s #1 Ticketing Platform
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
            Tap, Flex,{" "}
            <span className="relative inline-block">
              <span className="grad-text">Enter.</span>
            </span>
            <br />Repeat.
          </h1>

          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto font-normal">
            Your all-access pass to concerts, tech summits, and unforgettable experiences across Nigeria.
          </p>

          <HomeSearchBar />

          {/* Category pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {CATEGORIES.map(cat => (
              <Link
                key={cat}
                href={`/events?category=${cat}`}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-[#FFB700] hover:text-[#0E0D0D] text-white/80 border border-white/20 hover:border-[#FFB700] px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              >
                <span>{CATEGORY_ICONS[cat]}</span> {cat}
              </Link>
            ))}
          </div>
        </div>

      </section>

      {/* ── Featured Events ─────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-[#480082] py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[#FFB700] text-sm font-semibold uppercase tracking-widest mb-1">Hot Right Now</p>
                <h2 className="font-display text-3xl font-bold text-white">Featured Events</h2>
              </div>
              <Link href="/events" className="flex items-center gap-1 text-[#9F67FE] hover:text-white text-sm font-medium transition-colors">
                See all <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map(event => (
                <EventCard key={event.id} event={event} variant="featured" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Upcoming Events ─────────────────────────── */}
      <section className="bg-[#F9F8FF] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#9F67FE] text-sm font-semibold uppercase tracking-widest mb-1">Don&apos;t Miss Out</p>
              <h2 className="font-display text-3xl font-bold text-[#0E0D0D]">Upcoming Events</h2>
            </div>
            <Link href="/events" className="flex items-center gap-1 text-[#480082] hover:text-[#9F67FE] text-sm font-medium transition-colors">
              View all <ArrowRight size={16} />
            </Link>
          </div>

          {upcomingList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-[#eDdedd]">
              <p className="text-[#480082]/50 font-display text-xl">No upcoming events yet.</p>
              <Link href="/create" className="mt-4 inline-block text-[#480082] font-medium hover:underline">
                Be the first to host one →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingList.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Why FlexPass ────────────────────────────── */}
      <section className="bg-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <p className="text-[#FFB700] text-sm font-semibold uppercase tracking-widest mb-3">Why FlexPass?</p>
          <h2 className="font-display text-4xl font-bold text-[#0E0D0D]">0% Friction, 100% Flex</h2>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Zap className="h-7 w-7" />, title: "Instant Tickets", body: "Buy and receive your ticket in seconds. No queues, no stress." },
            { icon: <ShieldCheck className="h-7 w-7" />, title: "Secure Payments", body: "Every transaction is protected by Paystack's bank-grade security." },
            { icon: <Smartphone className="h-7 w-7" />, title: "Mobile-First", body: "Your ticket lives on your phone. Show the QR and walk right in." },
          ].map(f => (
            <div key={f.title} className="bg-[#F9F8FF] rounded-2xl p-8 border border-[#eDdedd] hover:border-[#9F67FE]/40 hover:shadow-lg hover:shadow-[#480082]/5 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-[#480082] text-white flex items-center justify-center mb-5 group-hover:bg-[#FFB700] group-hover:text-[#0E0D0D] transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-[#0E0D0D] mb-2">{f.title}</h3>
              <p className="text-[#0E0D0D]/60 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────── */}
      <section className="bg-[#480082] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Ready to host your <span className="text-[#FFB700]">next event?</span>
          </h2>
          <p className="text-white/70 mb-8 text-lg">
            Create an event in minutes. Sell tickets, manage attendees, and get paid.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-[#FFB700] text-[#0E0D0D] px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#e6a500] transition-colors shadow-lg shadow-[#FFB700]/20"
          >
            Create Event <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </main>
  );
}
