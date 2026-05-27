import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Get answers to common questions about buying tickets, hosting events, check-in, refunds, and payments on FlexPass.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
