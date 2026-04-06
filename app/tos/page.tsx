import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | FlexPass",
  description: "Read the Terms of Service governing your use of the FlexPass platform.",
};

const sections = [
  {
    number: "1",
    title: "Acceptance of Terms",
    content: `By accessing or using FlexPass (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Platform. FlexPass reserves the right to update these Terms at any time, and your continued use of the Platform following any changes constitutes acceptance of those changes.

These Terms apply to all users of the Platform, including event organizers ("Organizers") and ticket purchasers ("Consumers"). FlexPass Ltd is incorporated under the Companies and Allied Matters Act 2020 in the Federal Republic of Nigeria, with RC Number 9274513.`,
  },
  {
    number: "2",
    title: "Use of the Platform",
    content: `You agree to use the Platform only for lawful purposes and in a manner that does not infringe on the rights of others or restrict their use of the Platform. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

You must not use the Platform to host events that are fraudulent, illegal, or that violate the rights of third parties. FlexPass reserves the right to remove any event listing or suspend any account that violates these Terms without prior notice.

You must be at least 18 years of age to create an account or purchase tickets on the Platform. By using FlexPass, you confirm that you meet this requirement.`,
  },
  {
    number: "3",
    title: "Ticketing and Payments",
    content: `All ticket purchases are final unless the event is cancelled or significantly altered by the Organizer. Payment is processed securely through Paystack. By completing a purchase, you authorize FlexPass to charge the total amount shown at checkout, including any applicable service fees.

FlexPass charges a service fee of 5% on all ticket sales. This fee is non-refundable and is charged to the Consumer at the time of purchase. Organizers receive 95% of the ticket price directly via their registered bank account or Paystack subaccount.

Organizers are responsible for the accuracy of all event information listed on the Platform, including dates, times, locations, and pricing. FlexPass is not liable for losses arising from inaccurate event information provided by Organizers.`,
  },
  {
    number: "4",
    title: "Organizer Responsibilities",
    content: `Organizers who create events on FlexPass agree to deliver the event as described. In the event of cancellation, Organizers are responsible for notifying all ticket holders promptly and coordinating any applicable refunds in accordance with FlexPass's Refund Policy.

Organizers must provide accurate banking details and comply with all applicable tax obligations in Nigeria. FlexPass may request documentation for identity verification or tax reporting purposes. Failure to comply may result in suspension of payouts.

By hosting an event on FlexPass, Organizers grant FlexPass a non-exclusive, royalty-free licence to use event information, images, and descriptions for promotional purposes on the Platform and associated marketing channels.`,
  },
  {
    number: "5",
    title: "Intellectual Property",
    content: `All content on the FlexPass Platform, including but not limited to logos, graphics, text, and software, is the intellectual property of FlexPass Ltd or its licensors and is protected by applicable copyright and trademark laws.

Users may not reproduce, distribute, or create derivative works from any content on the Platform without express written permission from FlexPass. Event Organizers retain ownership of their own event content but grant FlexPass a licence to display and promote it as described in Section 4.`,
  },
  {
    number: "6",
    title: "Limitation of Liability",
    content: `To the fullest extent permitted by law, FlexPass shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to loss of revenue, data, or goodwill.

FlexPass is a technology platform and is not responsible for the quality, safety, legality, or any other aspect of the events listed on the Platform. Any disputes between Organizers and Consumers must be resolved between the parties directly.

FlexPass's total liability to any user for any claim arising out of or relating to these Terms shall not exceed the amount paid by that user to FlexPass in the three months preceding the claim.`,
  },
  {
    number: "7",
    title: "Termination",
    content: `FlexPass reserves the right to suspend or terminate your account at any time, with or without notice, if you breach these Terms or engage in conduct that FlexPass deems harmful to the Platform or its users.

You may terminate your account at any time by contacting our support team. Upon termination, your right to use the Platform ceases immediately. Any outstanding obligations, including unpaid fees or pending payouts, will survive termination.`,
  },
  {
    number: "8",
    title: "Governing Law",
    content: `These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Nigeria.

If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect. The failure of FlexPass to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.`,
  },
];

export default function TermsPage() {
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
            Terms of{" "}
            <span style={{ background: "linear-gradient(135deg, #9F67FE, #FFB700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Service
            </span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(240,238,248,0.65)" }}>
            Please read these terms carefully before using the FlexPass platform.
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
                  <p key={i} className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer callout */}
        <div
          className="mt-16 p-6 rounded-2xl"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
            Questions about these terms?
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            If you have any questions or concerns, please reach out to our team.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hello@flexpass.ng"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--brand-indigo)" }}
            >
              Contact Us
            </a>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition"
              style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-primary)" }}
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
