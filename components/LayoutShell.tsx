"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Both /dashboard and /admin have their own self-contained header/layout —
  // the public Navbar is `position: fixed`, so without this it doesn't
  // reserve space and just renders on top of (hiding) whatever's at the top
  // of those pages, like the admin page's own header and its buttons.
  const hasOwnLayout = pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin");

  return (
    <>
      {!hasOwnLayout && <Navbar />}
      {children}
      {!hasOwnLayout && <Footer />}
      <ThemeToggle />
    </>
  );
}
