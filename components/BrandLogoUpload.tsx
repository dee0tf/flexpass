"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Logos are shown whole (object-contain) on a light tile, unlike event
// images which ImageUpload crops to fill. SVG is left out on purpose: an
// uploaded SVG can carry script when opened directly from storage.
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
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `brand-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("event-images").upload(path, file);
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
          style={{ backgroundColor: "#F9F8FF", border: "2px dashed var(--card-border)" }}>
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
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>No logo yet</span>
          )}
        </div>

        <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition hover:opacity-90 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)", border: "1px solid var(--card-border)" }}>
          <Upload size={15} />
          {value ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>PNG, JPG or WebP, max 2MB. A transparent PNG looks best.</p>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
