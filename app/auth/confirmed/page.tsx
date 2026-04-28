"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

export default function EmailConfirmedPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay so the animation feels intentional
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <Logo size={44} variant="gradient" />
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-1.5 w-full grad-brand" />
          <div className="p-10 flex flex-col items-center gap-6">

            {/* Animated checkmark */}
            <div className={`relative flex items-center justify-center transition-all duration-700 ${mounted ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
              <span className="absolute h-24 w-24 rounded-full animate-ping" style={{ backgroundColor: "rgba(72,0,130,0.12)" }} />
              <span className="absolute h-20 w-20 rounded-full" style={{ backgroundColor: "rgba(72,0,130,0.08)" }} />
              <div className="relative h-20 w-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(72,0,130,0.15)", border: "2px solid var(--brand-indigo)" }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-indigo)" }} />
              </div>
            </div>

            <div className={`transition-all duration-500 delay-300 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
              <h1 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Email Verified!
              </h1>
              <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>
                Your email has been confirmed.
              </p>
              <p className="text-base font-semibold" style={{ color: "var(--brand-indigo)" }}>
                Welcome to FlexPass 🎉
              </p>
            </div>

            <div className={`w-full transition-all duration-500 delay-500 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
              <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Your account is now active. Log in to start creating events, selling tickets, and flexing.
                </p>
              </div>

              <Link href="/login"
                className="block w-full text-center py-3.5 rounded-xl font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                Log In to FlexPass
              </Link>
            </div>

          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
