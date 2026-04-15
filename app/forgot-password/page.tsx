"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <Logo size={44} variant="gradient" />
          </div>
          <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="h-1.5 w-full grad-brand" />
            <div className="p-10 flex flex-col items-center gap-5">
              <div className="h-20 w-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(72,0,130,0.12)", border: "2px solid var(--brand-indigo)" }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-indigo)" }} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  Check your inbox
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  We sent a password reset link to<br />
                  <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{email}</span>
                </p>
                <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
                  Didn&apos;t receive it? Check your spam folder or{" "}
                  <button onClick={() => setSent(false)} className="underline hover:no-underline" style={{ color: "var(--brand-indigo)" }}>
                    try again
                  </button>.
                </p>
              </div>
              <Link href="/login"
                className="mt-2 flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: "var(--brand-indigo)" }}>
                <ArrowLeft size={16} /> Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={44} variant="gradient" />
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="h-1.5 w-full grad-brand" />
          <div className="p-8">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors hover:opacity-70"
              style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={15} /> Back to login
            </Link>

            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Forgot password?
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              No worries. Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email" required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                    onBlur={() => { if (email && !emailRegex.test(email)) setEmailError("Please enter a valid email address."); }}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition ${emailError ? "ring-2 ring-red-400" : ""}`}
                    style={{ backgroundColor: "var(--input-bg)", border: `1px solid ${emailError ? "#f87171" : "var(--input-border)"}`, color: "var(--text-primary)" }}
                  />
                </div>
                {emailError && (
                  <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
                    <AlertCircle size={12} /> {emailError}
                  </p>
                )}
              </div>

              {error && (
                <p className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <button
                disabled={isLoading}
                className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
