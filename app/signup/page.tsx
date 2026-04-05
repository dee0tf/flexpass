"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, Mail } from "lucide-react";
import Logo from "@/components/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) { setEmailSent(true); return; }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor:"var(--background)"}}>
        <div className="w-full max-w-md text-center">
          <div className="rounded-3xl shadow-xl p-10" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
            <div className="h-16 w-16 bg-[#480082]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Mail className="h-8 w-8 text-[#480082]" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-3" style={{color:"var(--text-primary)"}}>Check your inbox</h2>
            <p className="text-[#0E0D0D]/50 mb-6 text-sm leading-relaxed">
              We sent a confirmation link to <strong className="text-[#480082]">{email}</strong>. Click it to activate your account.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors text-sm">
              Back to Login <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor:"var(--background)"}}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={44} variant="gradient" />
        </div>

        <div className="rounded-3xl shadow-xl overflow-hidden" style={{backgroundColor:"var(--card-bg)",border:"1px solid var(--card-border)"}}>
          <div className="h-1.5 w-full grad-brand" />
          <div className="p-8">
            <h1 className="font-display text-2xl font-bold mb-1" style={{color:"var(--text-primary)"}}>Join FlexPass</h1>
            <p className="text-sm mb-8" style={{color:"var(--text-muted)"}}>Start selling tickets today — it&apos;s free</p>

            <form onSubmit={handleSignup} className="space-y-5">
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
                  type="password" required minLength={8}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition" style={{backgroundColor:"var(--input-bg)",border:"1px solid var(--input-border)",color:"var(--text-primary)"}}
                  placeholder="Min. 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

              <button
                disabled={isLoading}
                className="w-full bg-[#FFB700] text-[#0E0D0D] py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 hover:bg-[#e6a500] disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account <ArrowRight size={18} /></>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#0E0D0D]/50">
              Already have an account?{" "}
              <Link href="/login" className="text-[#480082] font-semibold hover:text-[#9F67FE] transition-colors">Log in</Link>
            </p>
          </div>
        </div>
        <p className="text-center mt-6 text-xs text-[#0E0D0D]/30">Tap, Flex, Enter, Repeat.</p>
      </div>
    </div>
  );
}
