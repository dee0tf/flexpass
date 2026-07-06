"use client";

import { useState } from "react";
import { MapPin, Lock, Clock } from "lucide-react";

type LocationMode = "public" | "hidden" | "tba";

export interface LocationData {
  location: string;
  lat: number | null;
  lng: number | null;
  locationReveal: boolean;
}

interface LocationPickerProps {
  value: LocationData;
  onChange: (data: LocationData) => void;
}

function getMode(value: LocationData): LocationMode {
  if (!value.location || value.location === "TBA") return "tba";
  if (value.locationReveal) return "hidden";
  return "public";
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [mode, setMode] = useState<LocationMode>(() => getMode(value));

  const handleMode = (m: LocationMode) => {
    setMode(m);
    if (m === "tba") {
      onChange({ location: "TBA", lat: null, lng: null, locationReveal: false });
    } else {
      const loc = value.location === "TBA" ? "" : value.location;
      onChange({ ...value, location: loc, locationReveal: m === "hidden" });
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, location: e.target.value });
  };

  const inputStyle = { backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
        {([
          { m: "public" as const, icon: <MapPin size={13} />, label: "Public" },
          { m: "hidden" as const, icon: <Lock size={13} />, label: "Pay to Reveal" },
          { m: "tba" as const, icon: <Clock size={13} />, label: "TBA" },
        ] as const).map(({ m, icon, label }) => (
          <button key={m} type="button" onClick={() => handleMode(m)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition"
            style={mode === m
              ? { backgroundColor: "var(--brand-indigo)", color: "#fff" }
              : { color: "var(--text-muted)", backgroundColor: "transparent" }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Mode descriptions */}
      {mode === "tba" && (
        <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: "rgba(100,100,100,0.06)", color: "var(--text-muted)", border: "1px dashed var(--card-border)" }}>
          Venue shown as "To Be Announced" on the event page. Update it anytime before the event.
        </div>
      )}
      {mode === "hidden" && (
        <div className="px-3 py-2.5 rounded-xl text-sm flex items-start gap-2"
          style={{ backgroundColor: "rgba(72,0,130,0.05)", color: "var(--brand-indigo)", border: "1px solid rgba(72,0,130,0.15)" }}>
          <Lock size={13} className="mt-0.5 shrink-0" />
          Location stays hidden on the event page — only ticket holders can see it.
        </div>
      )}

      {/* Address field */}
      {mode !== "tba" && (
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Venue Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3.5 h-5 w-5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input type="text" value={value.location} onChange={handleAddressChange}
              placeholder="e.g. Eko Hotel & Suites, Victoria Island, Lagos"
              className="w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
              style={inputStyle} />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            Type the venue as attendees would search for it — they'll get a "Search on Map" button using this exact text.
          </p>
        </div>
      )}
    </div>
  );
}
