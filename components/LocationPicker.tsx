"use client";

import { useState } from "react";
import { MapPin, Lock, Clock, Search, Loader2, X, ExternalLink } from "lucide-react";

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
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  const handlePin = async () => {
    const q = value.location.trim();
    if (!q || q === "TBA") { setSearchError("Enter a venue address first"); return; }
    setSearchError("");
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (!data.length) { setSearchError("Location not found — try a more specific address"); return; }
      onChange({ ...value, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    } catch {
      setSearchError("Map lookup failed, please try again");
    } finally {
      setSearching(false);
    }
  };

  const clearPin = () => onChange({ ...value, lat: null, lng: null });

  const osmEmbedUrl = value.lat && value.lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - 0.008},${value.lat - 0.008},${value.lng + 0.008},${value.lat + 0.008}&layer=mapnik&marker=${value.lat},${value.lng}`
    : null;

  const osmDirectionsUrl = value.lat && value.lng
    ? `https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=16/${value.lat}/${value.lng}`
    : null;

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
        </div>
      )}

      {/* Map pin */}
      {mode !== "tba" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {!osmEmbedUrl ? (
              <button type="button" onClick={handlePin} disabled={searching}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 hover:opacity-80"
                style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {searching ? "Searching…" : "Pin on Map"}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium flex items-center gap-1" style={{ color: "var(--brand-indigo)" }}>
                  <MapPin size={13} /> Location pinned
                </span>
                <button type="button" onClick={clearPin}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition hover:opacity-80"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--card-border)" }}>
                  <X size={11} /> Clear
                </button>
              </div>
            )}
          </div>

          {searchError && <p className="text-xs text-red-500">{searchError}</p>}

          {osmEmbedUrl && osmDirectionsUrl && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <iframe src={osmEmbedUrl} width="100%" height="210" frameBorder="0"
                scrolling="no" title="Venue on map" style={{ display: "block" }} />
              <a href={osmDirectionsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium hover:opacity-80 transition"
                style={{ backgroundColor: "var(--surface-raised)", color: "var(--brand-indigo)" }}>
                <ExternalLink size={11} /> Open in OpenStreetMap
              </a>
            </div>
          )}
          {!osmEmbedUrl && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Optional — pin your venue on the map so attendees can get directions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
