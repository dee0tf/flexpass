"use client";

import Link from "next/link";
import { Mail, ArrowRight, Loader2, Check } from "lucide-react";
import Logo from "./Logo";
import { useState } from "react";

export default function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) { setStatus("success"); setMessage(data.message); setEmail(""); }
      else { setStatus("error"); setMessage(data.error || "Something went wrong"); }
    } catch {
      setStatus("error"); setMessage("Failed to connect. Try again.");
    }
  };

  return (
    <footer className="pt-16 pb-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ backgroundColor: "#0A0812", color: "rgba(240,238,248,0.5)" }}>
      {/* Glows */}
      <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "rgba(72,0,130,0.25)", filter: "blur(80px)" }} />
      <div className="absolute bottom-0 right-1/3 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "rgba(159,103,254,0.1)", filter: "blur(80px)" }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="space-y-5">
            <Link href="/"><Logo size={36} variant="white" /></Link>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(240,238,248,0.45)" }}>
              Your all-access pass to Nigeria&apos;s hottest events. Tap, Flex, Enter, Repeat.
            </p>
            <div className="flex gap-3">
              {[
                { label: "X", href: "#" },
                { label: "IG", href: "#" },
              ].map((s) => (
                <a key={s.label} href={s.href}
                  className="px-3 py-2 rounded-xl border text-xs font-bold transition-all hover:text-white"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(240,238,248,0.4)" }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8">
            {[
              { title: "Product", links: [["Find Events", "/events"], ["Host Event", "/create"]] },
              { title: "Company", links: [["About", "/about"], ["Privacy Policy", "/privacy"], ["Contact", "mailto:hello@flexpass.ng"]] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-white font-display font-semibold mb-5 text-xs uppercase tracking-widest">{col.title}</h4>
                <ul className="space-y-3 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="hover:text-[#FFB700] transition-colors">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Resources — placeholder until pages are built */}
          <div>
            <h4 className="text-white font-display font-semibold mb-5 text-xs uppercase tracking-widest">Support</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:hello@flexpass.ng" className="hover:text-white transition-colors">
                  hello@flexpass.ng
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-white font-display font-semibold mb-2 text-xs uppercase tracking-widest">Stay in the Loop</h4>
            <p className="text-sm mb-5" style={{ color: "rgba(240,238,248,0.35)" }}>Early access to the hottest events.</p>
            <form onSubmit={handleSubscribe} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4" style={{ color: "rgba(240,238,248,0.3)" }} />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={status === "loading" || status === "success"}
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-sm transition focus:outline-none disabled:opacity-50 text-white"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(159,103,254,0.2)",
                  }}
                />
              </div>
              {status === "success" ? (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 border border-green-400/20 px-4 py-3 rounded-xl">
                  <Check size={15} /> {message}
                </div>
              ) : (
                <button disabled={status === "loading"}
                  className="w-full py-3 rounded-xl font-bold text-sm text-[#0E0D0D] hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand-amber)" }}
                >
                  {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <><span>Subscribe</span><ArrowRight size={15} /></>}
                </button>
              )}
              {status === "error" && <p className="text-red-400 text-xs">{message}</p>}
            </form>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-3 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(240,238,248,0.25)" }}>
          <p>&copy; {year} FlexPass. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <p>Made with <span style={{ color: "var(--brand-amber)" }}>♥</span> in Lagos, Nigeria</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
