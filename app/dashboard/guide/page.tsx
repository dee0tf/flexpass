"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Rocket, Calendar, BarChart2, Users, ScanLine, Wallet,
  CheckCircle2, Lightbulb, Play, ChevronRight, ArrowRight, BookOpen,
} from "lucide-react";

// ── Swap these YouTube video IDs once you've recorded your walkthroughs ──
const VIDEO_IDS: Record<string, string> = {
  "getting-started": "REPLACE_VIDEO_ID",
  "creating-event":  "REPLACE_VIDEO_ID",
  "ticket-tiers":    "REPLACE_VIDEO_ID",
  "promoters":       "REPLACE_VIDEO_ID",
  "checkin":         "REPLACE_VIDEO_ID",
  "wallet":          "REPLACE_VIDEO_ID",
  "analytics":       "REPLACE_VIDEO_ID",
};

type Step = { title: string; body: string };
type Section = {
  id: string;
  icon: React.ElementType;
  label: string;
  accent: string;
  badge: string;
  description: string;
  steps: Step[];
  tips: string[];
};

const sections: Section[] = [
  {
    id: "getting-started",
    icon: Rocket,
    label: "Getting Started",
    accent: "#9F67FE",
    badge: "Start here",
    description:
      "Set up your FlexPass account and navigate the host dashboard before you create your first event.",
    steps: [
      {
        title: "Create your account",
        body: "Sign up at flexpass.ng with an active email — ticket receipts and payout notifications go here, so make it one you check regularly.",
      },
      {
        title: "Complete your profile",
        body: "Go to Dashboard → Settings and add your display name and profile photo. This is what attendees see on your event page.",
      },
      {
        title: "Explore the dashboard",
        body: "Your overview shows Total Revenue, Tickets Sold, and active Events in real time. Every number updates the moment a ticket is purchased.",
      },
      {
        title: "Bookmark your dashboard",
        body: "Save the dashboard link to your home screen. You'll check it constantly — before, during, and after every event.",
      },
    ],
    tips: [
      "Use a dedicated or business email to keep event communications separate from personal mail.",
      "Enable browser notifications for instant alerts when a ticket is sold.",
    ],
  },
  {
    id: "creating-event",
    icon: Calendar,
    label: "Creating an Event",
    accent: "#FFB700",
    badge: "Core skill",
    description:
      "Walk through the full event creation flow — from filling in details to going live and sharing your link.",
    steps: [
      {
        title: "Click 'Host an Event'",
        body: "From the homepage or your dashboard, click 'Host an Event' to open the event creation form.",
      },
      {
        title: "Fill in your event details",
        body: "Add the title, date & time, venue (use the location picker for accuracy), category, and a description that sells the vibe — not just the logistics.",
      },
      {
        title: "Upload a great cover image",
        body: "Use a high-quality banner at 16:9 ratio (minimum 1200×675px). A strong visual is the biggest factor in whether someone clicks your event on the listings page.",
      },
      {
        title: "Add your ticket tiers",
        body: "Create at least one tier — name it (Regular, VIP, Early Bird), set the price in NGN, and cap the quantity. Add as many tiers as you need.",
      },
      {
        title: "Publish your event",
        body: "Click 'Publish Event' and it goes live immediately on flexpass.ng/events — searchable by category, name, and date right away.",
      },
      {
        title: "Share the link",
        body: "Copy your event link from the event page. Drop it in WhatsApp groups, Instagram Stories, and TikTok captions to drive your first wave of sales.",
      },
    ],
    tips: [
      "Urgency in tier names converts — 'Early Bird (48 hrs only)' beats 'Regular' every time.",
      "Set quantity limits per tier to create scarcity, even if your venue holds thousands.",
      "You can edit event details after publishing, except the event date once tickets have been sold.",
    ],
  },
  {
    id: "ticket-tiers",
    icon: BarChart2,
    label: "Ticket Tiers",
    accent: "#48B2FF",
    badge: "Maximise revenue",
    description:
      "Layer multiple pricing tiers to capture every segment of your audience — from early adopters to last-minute VIPs.",
    steps: [
      {
        title: "Open Dashboard → My Events → Edit",
        body: "From My Events, click Edit on your event and scroll to the Ticket Tiers section.",
      },
      {
        title: "Add a new tier",
        body: "Click 'Add Tier'. Name it, price it in NGN, set the quantity available, and save. Repeat for every tier you want.",
      },
      {
        title: "Layer your pricing strategy",
        body: "A proven structure: Early Bird (low price, limited quantity) → Regular → VIP. Early Bird sells out fast and creates social proof that pushes later buyers off the fence.",
      },
      {
        title: "Cap every tier",
        body: "Always set a quantity cap per tier — even if your venue holds 2,000. Caps make each tier feel exclusive and push buyers to act faster.",
      },
      {
        title: "Create a free tier",
        body: "Set price to ₦0 for guestlist slots, press passes, or partner invites. Attendees claim a real QR-coded ticket — no payment flow, no awkward door lists.",
      },
    ],
    tips: [
      "Don't undercharge. Research what similar events in your city charge and match or exceed it.",
      "Your VIP tier should clearly state the perks (front row, drinks, lounge) — buyers won't pay 3× without a reason.",
      "Free tiers still generate a ticket record and QR code — perfect for headcount tracking on comp lists.",
    ],
  },
  {
    id: "promoters",
    icon: Users,
    label: "Working with Promoters",
    accent: "#FF6B6B",
    badge: "Grow your sales",
    description:
      "Manage your promotional team, track referral sales in real time, and reward your top performers.",
    steps: [
      {
        title: "Go to Dashboard → Promoters",
        body: "The Promoters tab is your hub for managing anyone selling tickets on your behalf — street teams, influencers, brand ambassadors.",
      },
      {
        title: "Add a promoter",
        body: "Click 'Add Promoter', enter their name and email. They receive an invite linking them to your event as an official seller.",
      },
      {
        title: "Share their unique link",
        body: "Each promoter gets a unique referral link for your event. Every ticket sold through that link is automatically attributed to them — no manual tracking needed.",
      },
      {
        title: "Monitor in real time",
        body: "The dashboard shows tickets sold, revenue generated, and conversion rate per promoter as sales happen — so you always know who's performing.",
      },
      {
        title: "Identify your best sellers",
        body: "Use the leaderboard to spot who's crushing it. These are the people to front-line for your next event — better commission, exclusives, and earlier access.",
      },
      {
        title: "Settle commissions",
        body: "Agree commission terms before the event (e.g. ₦500 per ticket sold), then pay manually via bank transfer based on their attributed sales shown in the dashboard.",
      },
    ],
    tips: [
      "Brief promoters on the event vibe, dress code, and tier details — an uninformed promoter is a wasted resource.",
      "Give top promoters an exclusive Early Bird link — it motivates them to push tickets hard in the first 48 hours.",
      "Check the promoters tab daily in the 72 hours before the event; that's when the final push matters most.",
    ],
  },
  {
    id: "checkin",
    icon: ScanLine,
    label: "Check-In on Event Day",
    accent: "#00D084",
    badge: "Door management",
    description:
      "Run a smooth, fast entry experience — scan QR codes, validate tickets, and handle edge cases with confidence.",
    steps: [
      {
        title: "Open Dashboard → Check-In",
        body: "On event day, open your dashboard on your phone and tap Check-In in the navigation menu.",
      },
      {
        title: "Select your event",
        body: "If you host multiple events, select today's event from the dropdown before you start scanning.",
      },
      {
        title: "Grant camera access",
        body: "The scanner needs camera permission. Tap Allow when prompted, and always use the rear camera — it reads QR codes significantly faster.",
      },
      {
        title: "Scan QR codes",
        body: "Point the camera at the attendee's QR code (phone or printed). Green means valid. Red means invalid or already scanned — do not let them through.",
      },
      {
        title: "Use manual lookup",
        body: "If a QR code won't scan, switch to manual mode — enter the ticket ID or attendee email to look up and validate the ticket.",
      },
      {
        title: "Handle duplicates firmly",
        body: "An 'Already Scanned' response means the ticket has been used. Escalate to security rather than admitting the person — one duplicate admission causes many.",
      },
    ],
    tips: [
      "Open Check-In 30 minutes before doors and test-scan 5 tickets before guests arrive.",
      "Assign one dedicated person per queue to the scanner — multitasking at the door causes bottlenecks.",
      "Charge your phones the night before. A dead scanner phone at 10pm is an emergency.",
      "Export your attendee list to CSV from My Tickets as a backup if the venue has poor internet.",
    ],
  },
  {
    id: "wallet",
    icon: Wallet,
    label: "Wallet & Getting Paid",
    accent: "#48B2FF",
    badge: "Payouts",
    description:
      "Add your bank account, understand how automatic Paystack settlements work, and withdraw your earnings.",
    steps: [
      {
        title: "Go to Dashboard → Wallet",
        body: "The Wallet section manages your bank details, shows your full payout history, and lets you request manual withdrawals.",
      },
      {
        title: "Add your bank account",
        body: "Click 'Add Bank Account'. Select your bank, enter your account number, and tap Verify. Your account name is confirmed automatically via Paystack.",
      },
      {
        title: "How automatic settlements work",
        body: "Once your bank is linked, 95% of every ticket sale settles directly to your account via Paystack on a T+1 basis (next business day). FlexPass retains a 5% service fee.",
      },
      {
        title: "Request a withdrawal",
        body: "For any earnings held in your FlexPass wallet balance, click Withdraw, enter the amount, and submit. An admin processes it within 24–48 hours.",
      },
      {
        title: "View your payout history",
        body: "All completed and pending payouts are listed with dates and amounts. Download for your records or share with your accountant.",
      },
    ],
    tips: [
      "Add your bank account before you publish your first event — payouts cannot process without it.",
      "Use a dedicated business account if you run multiple events regularly to keep bookkeeping clean.",
      "If a payout is delayed past T+2, email flexpasshome@gmail.com with your event name and expected amount.",
    ],
  },
  {
    id: "analytics",
    icon: BarChart2,
    label: "Dashboard Analytics",
    accent: "#9F67FE",
    badge: "Insights",
    description:
      "Read your real-time sales data, understand your audience, and use the numbers to make smarter decisions for every event.",
    steps: [
      {
        title: "Overview metrics",
        body: "Your dashboard overview shows Total Revenue, Tickets Sold, and active Events at a glance — all live, no refresh needed.",
      },
      {
        title: "Read the Sales Chart",
        body: "The bar chart shows daily ticket sales over time. Look for spikes — they align with Instagram posts, WhatsApp blasts, or influencer mentions. Use this to time your next push.",
      },
      {
        title: "Check Recent Tickets",
        body: "The Recent Tickets panel shows latest purchases — buyer name, email, tier, and timestamp. Use it to verify VIP buyer identities when needed.",
      },
      {
        title: "Go deeper with My Tickets",
        body: "Dashboard → My Tickets shows every ticket sold across all your events, filterable by event name. Resend receipts or revoke tickets directly from this table.",
      },
      {
        title: "Export your data",
        body: "Download ticket sales as a CSV from My Tickets for offline analysis, attendee management, or sharing with co-organizers and brand partners.",
      },
    ],
    tips: [
      "Compare tickets/day across events to learn which promotional tactics drive the fastest sales velocity.",
      "If sales plateau mid-campaign, a 'Last 50 tickets' Instagram post almost always causes a spike — urgency converts.",
      "After the event, check your check-in rate (QR scans ÷ tickets sold). Below 70% is worth investigating.",
    ],
  },
];

function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const isPlaceholder = videoId === "REPLACE_VIDEO_ID";

  if (isPlaceholder) {
    return (
      <div
        className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-14"
        style={{
          background: "linear-gradient(135deg, rgba(72,0,130,0.08), rgba(159,103,254,0.06))",
          border: "2px dashed rgba(159,103,254,0.25)",
        }}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(159,103,254,0.12)" }}>
          <Play size={24} style={{ color: "#9F67FE" }} />
        </div>
        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Video coming soon</p>
        <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
          Replace the VIDEO_ID in <code className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)" }}>app/dashboard/guide/page.tsx</code> to embed your walkthrough.
        </p>
      </div>
    );
  }

  if (playing) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative w-full rounded-2xl overflow-hidden group"
      style={{ paddingBottom: "56.25%", display: "block" }}
      aria-label={`Play: ${title}`}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={e => {
          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: "linear-gradient(135deg, rgba(72,0,130,0.72), rgba(10,8,18,0.6))" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: "#FFB700", boxShadow: "0 0 36px rgba(255,183,0,0.4)" }}
        >
          <Play size={26} className="text-[#0E0D0D] ml-1" />
        </div>
        <p className="text-white font-semibold text-sm px-6 text-center">{title}</p>
      </div>
    </button>
  );
}

function StepCard({ step, index, accent }: { step: Step; index: number; accent: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl transition-colors"
      style={{ backgroundColor: "var(--surface-raised)" }}>
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
        style={{ backgroundColor: accent }}
      >
        {index + 1}
      </div>
      <div>
        <p className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{step.title}</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.body}</p>
      </div>
    </div>
  );
}

function TipBox({ tips }: { tips: string[] }) {
  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{ backgroundColor: "rgba(72,0,130,0.05)", border: "1px solid rgba(72,0,130,0.15)" }}>
      <div className="flex items-center gap-2">
        <Lightbulb size={15} style={{ color: "var(--brand-indigo)" }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--brand-indigo)" }}>
          Pro Tips
        </span>
      </div>
      <ul className="space-y-2.5">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "var(--brand-indigo)" }} />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CreatorGuidePage() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const active = sections.find(s => s.id === activeId)!;

  const switchSection = (id: string) => {
    setActiveId(id);
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-tab="${activeId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={18} style={{ color: "var(--brand-indigo)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Creator Guide</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Step-by-step walkthroughs for every part of the FlexPass platform.
          </p>
        </div>
        <Link href="/create"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white hover:opacity-90 transition shrink-0"
          style={{ backgroundColor: "var(--brand-indigo)" }}>
          Create Event <ArrowRight size={14} />
        </Link>
      </div>

      {/* ── Mobile section tabs ── */}
      <div
        ref={tabsRef}
        className="md:hidden flex gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {sections.map(s => {
          const Icon = s.icon;
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              data-tab={s.id}
              onClick={() => switchSection(s.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
              style={isActive
                ? { backgroundColor: s.accent, color: "#fff" }
                : { backgroundColor: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--card-border)" }}
            >
              <Icon size={13} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Layout: sidebar + content ── */}
      <div className="flex gap-6 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-52 flex-shrink-0 sticky top-6">
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Sections
              </p>
            </div>
            <nav className="p-2 space-y-0.5">
              {sections.map(s => {
                const Icon = s.icon;
                const isActive = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => switchSection(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                    style={isActive
                      ? { backgroundColor: `${s.accent}18`, color: s.accent }
                      : { color: "var(--text-secondary)" }}
                  >
                    <Icon size={15} style={isActive ? { color: s.accent } : {}} />
                    <span className="leading-tight">{s.label}</span>
                    {isActive && <ChevronRight size={13} className="ml-auto shrink-0" style={{ color: s.accent }} />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Support card */}
          <div className="mt-4 p-4 rounded-2xl text-center"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Need help?</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Our team is always on standby.
            </p>
            <a
              href="mailto:flexpasshome@gmail.com"
              className="block w-full text-xs font-bold py-2 rounded-xl text-white hover:opacity-90 transition text-center"
              style={{ backgroundColor: "var(--brand-indigo)" }}
            >
              Contact Support
            </a>
          </div>
        </aside>

        {/* ── Content ── */}
        <div ref={contentRef} className="flex-1 min-w-0 space-y-6 scroll-mt-8">

          {/* Section intro */}
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${active.accent}18` }}>
                <active.icon size={20} style={{ color: active.accent }} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${active.accent}15`, color: active.accent }}>
                {active.badge}
              </span>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {active.label}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {active.description}
            </p>
          </div>

          {/* Video */}
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="px-6 py-4 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--card-border)" }}>
              <Play size={14} style={{ color: "var(--brand-indigo)" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Video Walkthrough
              </p>
            </div>
            <div className="p-6">
              <VideoEmbed
                videoId={VIDEO_IDS[active.id]}
                title={`${active.label} — FlexPass Creator Guide`}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="px-6 py-4"
              style={{ borderBottom: "1px solid var(--card-border)" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Step-by-Step
              </p>
            </div>
            <div className="p-6 space-y-3">
              {active.steps.map((step, i) => (
                <StepCard key={i} step={step} index={i} accent={active.accent} />
              ))}
            </div>
          </div>

          {/* Tips */}
          <TipBox tips={active.tips} />

          {/* Section navigation */}
          <div className="flex items-center justify-between pt-2">
            {(() => {
              const idx = sections.findIndex(s => s.id === activeId);
              const prev = sections[idx - 1];
              const next = sections[idx + 1];
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => switchSection(prev.id)}
                      className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition"
                      style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}
                    >
                      ← {prev.label}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button
                      onClick={() => switchSection(next.id)}
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white transition hover:opacity-90"
                      style={{ backgroundColor: next.accent }}
                    >
                      {next.label} →
                    </button>
                  ) : (
                    <Link
                      href="/create"
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-[#0E0D0D] hover:opacity-90 transition"
                      style={{ backgroundColor: "var(--brand-amber)" }}
                    >
                      Create your Event <ArrowRight size={14} />
                    </Link>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
