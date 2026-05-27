import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Brand typeface: Space Grotesk (body/UI) — Clash Display loaded via CSS @font-face
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.flexpasshq.com"),
  title: {
    default: "FlexPass — Nigeria's Premier Ticketing Platform",
    template: "%s | FlexPass",
  },
  description: "Tap, Flex, Enter, Repeat. Discover and secure tickets for the hottest events in Nigeria.",
  keywords: ["event tickets Nigeria", "buy tickets online Nigeria", "Lagos events", "Nigerian concerts", "FlexPass"],
  authors: [{ name: "FlexPass", url: "https://www.flexpasshq.com" }],
  creator: "FlexPass",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://www.flexpasshq.com",
    siteName: "FlexPass",
    title: "FlexPass — Nigeria's Premier Ticketing Platform",
    description: "Tap, Flex, Enter, Repeat. Discover and secure tickets for the hottest events in Nigeria.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlexPass — Nigeria's Premier Ticketing Platform",
    description: "Tap, Flex, Enter, Repeat. Discover and secure tickets for the hottest events in Nigeria.",
    creator: "@flexpasshq",
    site: "@flexpasshq",
  },
  alternates: {
    canonical: "https://www.flexpasshq.com",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.flexpasshq.com/#organization",
      name: "FlexPass",
      url: "https://www.flexpasshq.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.flexpasshq.com/logo.png",
        width: 512,
        height: 512,
      },
      sameAs: [
        "https://www.instagram.com/flexpass__",
        "https://www.tiktok.com/@flexpass__",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@flexpass.ng",
        contactType: "customer support",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://www.flexpasshq.com/#website",
      url: "https://www.flexpasshq.com",
      name: "FlexPass",
      description: "Nigeria's Premier Event Ticketing Platform",
      publisher: { "@id": "https://www.flexpasshq.com/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://www.flexpasshq.com/events?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Clash Display from Fontshare CDN */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <LayoutShell>{children}</LayoutShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
