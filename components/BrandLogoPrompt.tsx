"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Optional, never blocking: hosts without a brand logo get this banner on the
// create page (the dashboard shows BrandLogoPopup instead). "Skip for now" hides it for a week.
const DISMISS_KEY = "fp-brand-prompt-dismissed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export default function BrandLogoPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (snoozed()) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data, error } = await supabase
        .from("host_brands")
        .select("logo_url")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!cancelled && !error && !data?.logo_url) setShow(true);
    })();
    return () => { cancelled = true; };
  }, []);

  function skip() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="relative mb-6 rounded-2xl p-5 pr-12 text-white overflow-hidden flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ background: "linear-gradient(135deg, #480082 0%, #6A23B8 60%, #9F67FE 100%)", boxShadow: "0 12px 32px rgba(72,0,130,0.25)" }}>
      <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <ImagePlus size={24} style={{ color: "#FFB700" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-lg leading-tight">Add your brand logo</p>
        <p className="text-sm text-white/80 mt-0.5">
          Get featured in the <span className="font-semibold text-white">Trusted by</span> section on the FlexPass homepage. Takes 30 seconds.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/dashboard/settings#brand"
          className="px-4 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90"
          style={{ backgroundColor: "#FFB700", color: "#0E0D0D" }}>
          Upload logo
        </Link>
        <button onClick={skip} className="text-sm font-medium text-white/70 hover:text-white transition">
          Skip for now
        </button>
      </div>
      <button onClick={skip} aria-label="Dismiss" className="absolute top-3 right-3 p-1 rounded-lg text-white/60 hover:text-white transition">
        <X size={18} />
      </button>
    </div>
  );
}
