"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import ThemeToggle from "@/components/ThemeToggle";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return (
    <>
      {isLoading && <LoadingSpinner />}
      {!isDashboard && <Navbar />}
      {children}
      {!isDashboard && <Footer />}
      {/* Theme toggle lives outside nav/footer so it floats on every page */}
      <ThemeToggle />
    </>
  );
}
