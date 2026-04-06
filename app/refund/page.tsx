import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy | FlexPass",
  description: "Understand FlexPass's refund and cancellation policy for ticket purchases.",
};

const sections = [
  {
    number: "1",
    title: "General Policy",
    content: `All ticket sales on FlexPass are final. Due to the nature of event ticketing, we generally do not offer refunds after a ticket has been purchased. However, exceptions are made in the specific circumstances outlined in this policy.

FlexPass acts as a technology intermediary between event Organizers and Consumers. Refund decisions for non-cancelled events are ultimately at the discretion of the Organizer. FlexPass will facilitate the process where possible but cannot guarantee a refund unless the event has been officially cancelled.`,
  },
  {
    number: "2",
    title: "Event Cancellation by Organizer",
    content: `If an Organizer cancels an event, all ticket holders are entitled to a full refund of the ticket price paid. The FlexPass service fee (5%) may be non-refundable as it covers the cost of processing and platform services.

In the event of a cancellation, FlexPass will notify all ticket holders via the email address provided at the time of purchase. Organizers are required to notify FlexPass at least 24 hours before the scheduled event start time for the cancellation to be processed smoothly.

Refunds for cancelled events will be processed within 7–14 business days, depending on your bank or card issuer. FlexPass will make every reasonable effort to ensure refunds are processed promptly.`,
  },
  {
    number: "3",
    title: "Event Postponement or Rescheduling",
    content: `If an event is postponed or rescheduled, your ticket will remain valid for the new date. FlexPass will notify all affected ticket holders of the new event details via email.

If you are unable to attend on the new date, you may request a refund by contacting our support team within 7 days of receiving the rescheduling notification. Refund requests submitted after this window may not be honoured at the Organizer's discretion.`,
  },
  {
    number: "4",
    title: "Partial Delivery of Event",
    content: `If an event is significantly altered from what was advertised (e.g., key performers cancel, venue changes materially), you may be eligible for a partial refund at the Organizer's discretion. FlexPass will mediate between the Organizer and Consumer where a dispute arises.

FlexPass does not guarantee refunds for changes in event lineup, support acts, or minor alterations that do not fundamentally change the nature of the event.`,
  },
  {
    number: "5",
    title: "Non-Refundable Circumstances",
    content: `Refunds will not be issued in the following circumstances:

— You are unable to attend for personal reasons (illness, travel issues, change of plans).
— You did not receive a reminder notification for the event.
— You purchased the wrong ticket type or for the wrong date.
— The event proceeded as advertised and you were not satisfied with the experience.
— Your ticket was used for entry.

We strongly recommend reviewing all event details carefully before completing your purchase.`,
  },
  {
    number: "6",
    title: "Ticket Transfers",
    content: `If you are unable to attend an event, you may transfer your ticket to another person by contacting FlexPass support with the new attendee's name and email address. Ticket transfers are subject to Organizer approval and must be requested at least 48 hours before the event.

FlexPass is not responsible for tickets sold or transferred through unofficial channels. Tickets purchased from third parties may not be honoured at the venue.`,
  },
  {
    number: "7",
    title: "How to Request a Refund",
    content: `To request a refund for an eligible event, please contact our support team at hello@flexpass.ng with the following information:

— Your full name and email address used at purchase.
— Your ticket ID (found in your confirmation email or ticket page).
— The reason for your refund request.

Our team will review your request and respond within 3 business days. Approved refunds will be returned to the original payment method used at checkout.`,
  },
];

export default function RefundPage() {
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
            Legal
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Refund{" "}
            <span style={{ background: "linear-gradient(135deg, #9F67FE, #FFB700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Policy
            </span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(240,238,248,0.65)" }}>
            Everything you need to know about cancellations, refunds, and ticket transfers.
          </p>
          <p className="text-sm mt-4" style={{ color: "rgba(240,238,248,0.35)" }}>
            Effective date: April 2025
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-4 py-20">
        <div className="space-y-12">
          {sections.map((s) => (
            <div key={s.number}>
              <h2
                className="text-2xl font-bold mb-4 pb-3"
                style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--card-border)" }}
              >
                <span style={{ color: "var(--brand-indigo)" }}>{s.number}.</span> {s.title}
              </h2>
              <div className="space-y-4">
                {s.content.split("\n\n").map((para, i) => (
                  <p key={i} className="text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact callout */}
        <div
          className="mt-16 p-6 rounded-2xl"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
            Need help with a refund?
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Our support team is here to help. Send us your ticket ID and we&apos;ll get back to you within 3 business days.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hello@flexpass.ng"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-indigo)" }}
            >
              Email Support
            </a>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)" }}
            >
              View FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
