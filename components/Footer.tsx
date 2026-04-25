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
              {/* Instagram */}
              <a href="https://www.instagram.com/flexpass__" target="_blank" rel="noopener noreferrer"
                className="p-2.5 rounded-xl border transition-all hover:text-white hover:border-white/20"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(240,238,248,0.4)" }}
                aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              {/* TikTok */}
              <a href="https://www.tiktok.com/@flexpass__?_r=1&_t=ZP-95oqPw9GQZi" target="_blank" rel="noopener noreferrer"
                className="p-2.5 rounded-xl border transition-all hover:text-white hover:border-white/20"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(240,238,248,0.4)" }}
                aria-label="TikTok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                </svg>
              </a>
              {/* WhatsApp */}
              <a href="https://wa.me/2348000000000" target="_blank" rel="noopener noreferrer"
                className="p-2.5 rounded-xl border transition-all hover:text-white hover:border-white/20"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(240,238,248,0.4)" }}
                aria-label="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8">
            {[
              { title: "Product", links: [["Find Events", "/events"], ["Host Event", "/create"]] },
              { title: "Company", links: [["About", "/about"], ["FAQ", "/faq"], ["Privacy Policy", "/privacy"], ["Terms of Service", "/tos"], ["Refund Policy", "/refund"]] },
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
                <a href="mailto:admin@flexpasshq.com" className="hover:text-white transition-colors">
                  admin@flexpasshq.com
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
