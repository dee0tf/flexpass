"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandLogoUpload from "@/components/BrandLogoUpload";

// Shown once per visit to hosts without a brand logo, as soon as they land
// in the dashboard after logging in. Optional: "Maybe later" closes it until
// their next visit (sessionStorage), it never blocks anything.
const SEEN_KEY = "fp-brand-popup-seen";

export default function BrandLogoPopup() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [logo, setLogo] = useState("");
  const [showInTrustedBy, setShowInTrustedBy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {}
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data, error } = await supabase
        .from("host_brands")
        .select("logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      // On a query error (e.g. table not migrated yet) stay quiet rather than
      // nagging with a popup whose save would fail.
      if (cancelled || error || data?.logo_url) return;
      setUserId(user.id);
      setBrandName(user.user_metadata?.organizer_name || user.user_metadata?.full_name || "");
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  function close() {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  }

  async function save() {
    if (!logo) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("host_brands").upsert({
      user_id: userId,
      brand_name: brandName || null,
      logo_url: logo,
      show_in_trusted_by: showInTrustedBy,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setError("Couldn't save your logo — please try again.");
      return;
    }
    setSaved(true);
    setTimeout(close, 1600);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="brand-popup-title">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>

        <div className="relative p-6 pb-5 text-white" style={{ background: "linear-gradient(135deg, #480082 0%, #6A23B8 60%, #9F67FE 100%)" }}>
          <button onClick={close} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <ImagePlus size={24} style={{ color: "#FFB700" }} />
          </div>
          <h2 id="brand-popup-title" className="font-display font-bold text-xl leading-tight">Add your brand logo</h2>
          <p className="text-sm text-white/80 mt-1">
            Get featured in the <span className="font-semibold text-white">Trusted by</span> section on the FlexPass homepage, seen by everyone browsing events.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {saved ? (
            <p className="text-center font-bold py-6 text-green-600">Logo saved — thanks! 🎉</p>
          ) : (
            <>
              <BrandLogoUpload value={logo} onChange={setLogo} />

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={showInTrustedBy} onChange={e => setShowInTrustedBy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#480082]" />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Show my logo in FlexPass&apos;s <span className="font-semibold">Trusted by</span> section on the homepage
                </span>
              </label>

              {error && <p className="text-xs font-medium text-red-500">{error}</p>}

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={!logo || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#FFB700", color: "#0E0D0D" }}>
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  Save logo
                </button>
                <button onClick={close} className="px-4 py-3 text-sm font-medium transition hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                  Maybe later
                </button>
              </div>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                You can also add or change it anytime in Settings → Brand Logo.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
