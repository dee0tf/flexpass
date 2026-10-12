"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanLogoFile } from "@/lib/cleanLogo";

// Logos are shown whole (object-contain) on the dark "Trusted by" strip, so
// uploads are trimmed and any solid backdrop is made transparent first.
// SVG is left out on purpose: an uploaded SVG can carry script when opened
// directly from storage.
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export default function BrandLogoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Use a PNG, JPG or WebP image. A transparent PNG looks best.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Logo must be under 2MB.");
      return;
    }

    setUploading(true);
    try {
      const png = await cleanLogoFile(file);
      const path = `brand-${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage.from("event-images").upload(path, png, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError("Upload failed: " + (err instanceof Error ? err.message : "please try again"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-40 shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#0E0D0D", border: "2px dashed var(--card-border)" }}>
          {value ? (
            <>
              <Image src={value} alt="Your brand logo" fill sizes="160px" className="object-contain p-3" />
              <button type="button" onClick={() => onChange("")} aria-label="Remove logo"
                className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full">
                <X size={14} />
              </button>
            </>
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} />
          ) : (
            <span className="text-xs font-medium text-white/50">No logo yet</span>
          )}
        </div>

        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition hover:opacity-90 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
          <Upload size={15} />
          {value ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>PNG, JPG or WebP, max 2MB. We trim it and remove a plain background automatically; the preview shows how it looks on the homepage.</p>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
