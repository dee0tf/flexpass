"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // Supabase sends the user here with a recovery token in the URL hash.
  // onAuthStateChange fires PASSWORD_RECOVERY once it parses that token.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if already in a valid session (e.g. user refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <Logo size={44} variant="gradient" />
          </div>
          <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="h-1.5 w-full grad-brand" />
            <div className="p-10 flex flex-col items-center gap-5">
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 rounded-full animate-ping absolute" style={{ backgroundColor: "rgba(72,0,130,0.15)" }} />
                <div className="h-20 w-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(72,0,130,0.12)", border: "2px solid var(--brand-indigo)" }}>
                  <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-indigo)" }} />
                </div>
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  Password updated!
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Taking you to your dashboard…
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-indigo)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <Logo size={44} variant="gradient" />
          </div>
          <div className="rounded-3xl shadow-xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="h-1.5 w-full grad-brand" />
            <div className="p-10 flex flex-col items-center gap-6">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
              <div>
                <h2 className="font-display text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  Verifying your link…
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  If this takes too long, your reset link may have expired.{" "}
                  <Link href="/forgot-password" className="underline font-semibold" style={{ color: "var(--brand-indigo)" }}>
                    Request a new one
                  </Link>.
                </p>
              </div>
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
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-6"
              style={{ backgroundColor: "rgba(72,0,130,0.1)" }}>
              <Lock className="h-6 w-6" style={{ color: "var(--brand-indigo)" }} />
            </div>

            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Set new password
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required
                    placeholder="Min. 8 characters"
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

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"} required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full pl-4 pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 transition ${
                      confirmPassword && password !== confirmPassword ? "ring-2 ring-red-400" : ""
                    }`}
                    style={{
                      backgroundColor: "var(--input-bg)",
                      border: `1px solid ${confirmPassword && password !== confirmPassword ? "#f87171" : "var(--input-border)"}`,
                      color: "var(--text-primary)"
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-3.5 p-0.5 rounded transition hover:opacity-70"
                    style={{ color: "var(--text-muted)" }} tabIndex={-1}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
                    <AlertCircle size={12} /> Passwords do not match.
                  </p>
                )}
              </div>

              {error && (
                <p className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">
                  <AlertCircle size={15} /> {error}
                </p>
              )}

              <button
                disabled={isLoading || (!!confirmPassword && password !== confirmPassword)}
                className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-muted)" }}>Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
