import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap, ShieldCheck, Smartphone, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About | FlexPass",
  description:
    "FlexPass is a modern ticketing platform built to simplify how people discover, access, and experience events in Nigeria.",
};

const pillars = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Fast & Simple",
    body: "Purchase tickets in seconds. No queues, no paperwork — just a smooth experience from start to entry.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "Secure Transactions",
    body: "Every payment is verified server-side through Paystack. Your money and data are always protected.",
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: "Mobile-First",
    body: "Your ticket lives on your phone. Scan the QR code at the door — no printing required.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Built for Creators",
    body: "Powerful tools for organizers — real-time sales dashboards, tier pricing, and instant payouts.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4 text-center"
        style={{ backgroundColor: "#0A0812" }}>
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30"
            style={{ background: "radial-gradient(ellipse, #480082 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-6 tracking-widest uppercase"
            style={{ backgroundColor: "rgba(159,103,254,0.15)", color: "#9F67FE", border: "1px solid rgba(159,103,254,0.3)" }}>
            Our Story
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            About <span style={{
              background: "linear-gradient(135deg, #9F67FE, #FFB700)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>FlexPass</span>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed" style={{ color: "rgba(240,238,248,0.65)" }}>
            A modern ticketing platform built to simplify how people discover,
            access, and experience events.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-3xl mx-auto px-4 py-20 space-y-8">
        {[
          `FlexPass is a modern ticketing platform built to simplify how people discover, access, and experience events. We provide a seamless and flexible solution for event organizers and attendees, making ticketing smarter, faster, and more convenient.`,
          `At FlexPass, we understand that every event is unique — from concerts and conferences to private gatherings and large-scale experiences. That's why our platform is designed to offer adaptable ticketing options that give users the freedom to choose how and when they attend, while giving organizers powerful tools to manage and grow their events.`,
          `Our mission is to remove the friction from ticketing by combining reliability, innovation, and user-friendly design. With secure transactions, real-time updates, and intuitive management features, FlexPass ensures a smooth experience from purchase to entry.`,
          `We are committed to helping event creators maximize reach and revenue, while giving attendees a stress-free way to engage with the moments that matter most.`,
        ].map((para, i) => (
          <p key={i} className="text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {para}
          </p>
        ))}

        {/* Mission callout */}
        <blockquote className="border-l-4 pl-6 py-2 my-10 italic text-xl font-medium"
          style={{ borderColor: "var(--brand-indigo)", color: "var(--text-primary)" }}>
          "At FlexPass, it's not just about tickets — it's about creating access,
          flexibility, and unforgettable experiences."
        </blockquote>
      </section>

      {/* Pillars */}
      <section className="py-16 px-4" style={{ backgroundColor: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12"
            style={{ color: "var(--text-primary)" }}>
            What we stand for
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((p) => (
              <div key={p.title} className="p-6 rounded-2xl"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: "rgba(72,0,130,0.1)", color: "var(--brand-indigo)" }}>
                  {p.icon}
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Ready to flex?
          </h2>
          <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
            Discover events near you or launch your own in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/events"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-indigo)" }}>
              Find Events <ArrowRight size={16} />
            </Link>
            <Link href="/create"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-amber)", color: "#0E0D0D" }}>
              Host an Event <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
