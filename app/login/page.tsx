"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Loader2, LogIn, Mail, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import Logo from "@/components/Logo";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = (val: string) => {
    if (val && !emailRegex.test(val)) setEmailError("Please enter a valid email address.");
    else setEmailError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRegex.test(email)) { setEmailError("Please enter a valid email address."); return; }
    setIsLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Show success animation briefly then hard-redirect
      setSuccess(true);
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid login credentials.");
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* Animated circle */}
          <div className="relative flex items-center justify-center">
            <div className="h-24 w-24 rounded-full animate-ping absolute"
              style={{ backgroundColor: "rgba(72,0,130,0.15)" }} />
            <div className="h-24 w-24 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(72,0,130,0.12)", border: "2px solid var(--brand-indigo)" }}>
              <CheckCircle2 className="h-12 w-12" style={{ color: "var(--brand-indigo)" }} />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Welcome back! 🎉
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Successfully logged in. Taking you to your dashboard…
            </p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-indigo)" }} />
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
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>Login to manage your events</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email" required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                    onBlur={() => validateEmail(email)}
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

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                    style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-3.5 p-0.5 rounded transition hover:opacity-70"
                    style={{ color: "var(--text-muted)" }} tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <button disabled={isLoading}
                className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn size={18} /> Log In</>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors">Sign up</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
