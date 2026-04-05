"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor:"var(--background)"}}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size={44} variant="gradient" />
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
          {/* Header bar */}
          <div className="h-1.5 w-full grad-brand" />

          <div className="p-8">
            <h1 className="font-display text-2xl font-bold mb-1" style={{color:"var(--text-primary)"}}>Welcome back</h1>
            <p className="text-sm mb-8" style={{color:"var(--text-muted)"}}>Login to manage your events</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{color:"var(--text-secondary)"}}>Email Address</label>
                <input
                  type="email" required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition" style={{backgroundColor:"var(--input-bg)",border:"1px solid var(--input-border)",color:"var(--text-primary)"}}
                  placeholder="host@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{color:"var(--text-secondary)"}}>Password</label>
                <input
                  type="password" required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition" style={{backgroundColor:"var(--input-bg)",border:"1px solid var(--input-border)",color:"var(--text-primary)"}}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

              <button
                disabled={isLoading}
                className="w-full bg-[#480082] hover:bg-[#3a006b] text-white py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn size={18} /> Log In</>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#0E0D0D]/50">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors">Sign up</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-[#0E0D0D]/30">Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
