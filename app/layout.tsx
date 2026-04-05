import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

// Brand typeface: Space Grotesk (body/UI) — Clash Display loaded via CSS @font-face
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FlexPass — Nigeria's Premier Ticketing Platform",
  description: "Tap, Flex, Enter, Repeat. Discover and secure tickets for the hottest events in Nigeria.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Clash Display from Fontshare CDN */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
