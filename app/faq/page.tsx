"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    category: "Tickets & Purchasing",
    items: [
      {
        q: "How do I get my ticket after purchase?",
        a: "Immediately after a successful payment, your ticket is generated and displayed on screen. A copy is also sent to the email address you provided during checkout. Keep that email safe — it contains your ticket ID and QR code.",
      },
      {
        q: "Can I buy multiple tickets at once?",
        a: "Yes. During checkout, use the quantity selector to choose up to 10 tickets per transaction. Each ticket will have its own unique QR code for entry.",
      },
      {
        q: "What payment methods are accepted?",
        a: "We accept all major debit and credit cards, bank transfers, and mobile wallets through Paystack — including GTBank, Access, Zenith, OPay, PalmPay, and more.",
      },
      {
        q: "Is my payment secure?",
        a: "Yes. All payments are processed by Paystack, a PCI-DSS-compliant payment processor. FlexPass never stores your card details. Every transaction is verified server-side before your ticket is issued.",
      },
      {
        q: "I paid but didn't receive a ticket — what do I do?",
        a: "First, check your spam/junk folder. If it's not there, email us at hello@flexpass.ng with your payment reference and we'll sort it out within a few hours.",
      },
    ],
  },
  {
    category: "Check-In & Entry",
    items: [
      {
        q: "How does check-in work at the event?",
        a: "Show your QR code (from the ticket page or your confirmation email) at the entrance. The organizer scans it using the FlexPass check-in tool. Once scanned, the ticket is marked as used and cannot be reused.",
      },
      {
        q: "What if my phone dies at the door?",
        a: "Take a screenshot of your QR code before you leave home — it works even without internet. You can also print your ticket if needed.",
      },
      {
        q: "Can someone else use my ticket?",
        a: "Each QR code is unique and single-use. Once it's scanned at the door, it cannot be used again. If you need to transfer your ticket to someone else, contact us at hello@flexpass.ng before the event.",
      },
    ],
  },
  {
    category: "Refunds & Cancellations",
    items: [
      {
        q: "Can I get a refund if I can't attend?",
        a: "All ticket sales are generally final. Refunds are only issued if the event is cancelled or significantly changed by the organizer. See our full Refund Policy for details.",
      },
      {
        q: "What happens if the event is cancelled?",
        a: "If an organizer cancels their event, all ticket holders are entitled to a refund of the ticket price. We will notify you by email and process refunds within 7–14 business days.",
      },
      {
        q: "Can I transfer my ticket to a friend?",
        a: "Yes. Email hello@flexpass.ng with your ticket ID and your friend's name and email address at least 48 hours before the event. We'll update the ticket accordingly.",
      },
    ],
  },
  {
    category: "Hosting an Event",
    items: [
      {
        q: "How do I create an event on FlexPass?",
        a: "Sign up or log in, then click 'Host an Event' from the homepage or your dashboard. Fill in your event details — title, date, location, ticket price, and a cover image — and publish. Your event goes live immediately.",
      },
      {
        q: "How do I receive my money from ticket sales?",
        a: "Add your bank account details in your dashboard under Settings. FlexPass registers you with Paystack so that 95% of every ticket sale goes directly to your bank account automatically at settlement. FlexPass keeps 5% as a service fee.",
      },
      {
        q: "When are funds settled to my account?",
        a: "Paystack settles funds on a T+1 basis (next business day) for most Nigerian banks. Exact settlement timing depends on your bank and Paystack's schedule.",
      },
      {
        q: "Can I set different ticket tiers (e.g. VIP and Regular)?",
        a: "Yes. When creating or editing an event, you can add multiple ticket tiers with different names and prices. Buyers can then choose which tier they want during checkout.",
      },
      {
        q: "How do I check in attendees at the door?",
        a: "Go to Dashboard → Check-In. Select your event, then use the camera to scan attendee QR codes or enter ticket IDs manually. The system shows instant valid/invalid feedback.",
      },
    ],
  },
  {
    category: "Account & Security",
    items: [
      {
        q: "Do I need an account to buy a ticket?",
        a: "No. You can purchase tickets as a guest using just your name and email. However, creating an account lets you view all your past tickets in one place from your dashboard.",
      },
      {
        q: "How do I reset my password?",
        a: "On the login page, click 'Forgot password?' and enter your email. You'll receive a password reset link within a few minutes.",
      },
      {
        q: "How do I delete my account?",
        a: "Email hello@flexpass.ng from your registered email address and request account deletion. We'll process it within 5 business days in accordance with the Nigeria Data Protection Act.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left gap-4"
      >
        <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{q}</span>
        {open
          ? <ChevronUp className="shrink-0 h-5 w-5" style={{ color: "var(--brand-indigo)" }} />
          : <ChevronDown className="shrink-0 h-5 w-5" style={{ color: "var(--text-muted)" }} />
        }
      </button>
      {open && (
        <div
          className="px-5 pb-5 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--card-border)" }}
        >
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>

      {/* Hero */}
      <section
        className="relative overflow-hidden py-24 px-4 text-center"
        style={{ backgroundColor: "#0A0812" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30"
            style={{ background: "radial-gradient(ellipse, #480082 0%, transparent 70%)" }}
          />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-6 tracking-widest uppercase"
            style={{ backgroundColor: "rgba(159,103,254,0.15)", color: "#9F67FE", border: "1px solid rgba(159,103,254,0.3)" }}
          >
            Help Center
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Frequently Asked{" "}
            <span style={{ background: "linear-gradient(135deg, #9F67FE, #FFB700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Questions
            </span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(240,238,248,0.65)" }}>
            Everything you need to know about buying tickets, hosting events, and getting paid.
          </p>
        </div>
      </section>

      {/* FAQ Body */}
      <section className="max-w-3xl mx-auto px-4 py-20 space-y-14">
        {faqs.map((group) => (
          <div key={group.category}>
            <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
              {group.category}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div
          className="p-6 rounded-2xl text-center"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
            Still have questions?
          </h3>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            Can&apos;t find what you&apos;re looking for? Our team is happy to help.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="mailto:hello@flexpass.ng"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-indigo)" }}
            >
              Email Us
            </a>
            <a
              href="https://wa.me/2348000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "#25D366", color: "#fff" }}
            >
              WhatsApp
            </a>
            <Link
              href="/refund"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)" }}
            >
              Refund Policy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
