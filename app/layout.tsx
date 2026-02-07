"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState, useEffect } from "react";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    // Remove loading spinner as soon as React hydrates
    setIsLoading(false);
  }, []);

  return (
    <html lang="en">
      <head>
        <title>FlexPass - Nigerian Ticket Selling Platform</title>
        <meta name="description" content="Your gateway to amazing events in Nigeria" />
      </head>
      <body
        className={`${plusJakartaSans.variable} font-sans antialiased`}
      >
        {isLoading && <LoadingSpinner />}
        {!isDashboard && <Navbar />}
        {children}
        {!isDashboard && <Footer />}
      </body>
    </html>
  );
}
