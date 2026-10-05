"use client";

import { useState, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

// The theme lives on <html class="dark">, set before paint by the inline
// script in app/layout.tsx. Every toggle instance (navbar, mobile drawer,
// dashboard sidebar) reads it from there and watches it for changes, so
// flipping one keeps all the others in sync.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";
// null on the server — render nothing until we know the real theme
const getServerSnapshot = (): Theme | null => null;

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  try { localStorage.setItem("fp-theme", t); } catch {}
}

interface ThemeToggleProps {
  /**
   * - "fab": round floating button, bottom-left — the public-site toggle.
   *   The chat launcher owns the bottom-right corner, so the two never meet.
   * - "row": full-width menu row with a switch, for the dashboard sidebar
   */
  variant?: "fab" | "row";
}

export default function ThemeToggle({ variant = "row" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [animating, setAnimating] = useState(false);

  if (!theme) return null;
  const isDark = theme === "dark";

  function toggle() {
    if (animating) return;
    setAnimating(true);
    applyTheme(isDark ? "light" : "dark");
    setTimeout(() => setAnimating(false), 400);
  }

  const label = `Switch to ${isDark ? "light" : "dark"} mode`;
  const icon = (
    <span className={animating ? "animate-theme-pop" : ""}>
      {isDark ? <Sun size={18} className="text-[#FFB700]" /> : <Moon size={18} />}
    </span>
  );

  if (variant === "fab") {
    return (
      <button
        onClick={toggle}
        aria-label={label}
        title={label}
        // bottom-24 on mobile clears the event page's sticky buy bar, the
        // same offset the chat launcher uses on the opposite side. z-30 keeps
        // it under the mobile menu drawer (z-40). .fp-theme-fab hides it
        // while the live chat is opening or open (see globals.css).
        className={`fp-theme-fab fixed bottom-24 left-4 md:bottom-6 md:left-6 z-30 h-12 w-12 rounded-full border flex items-center justify-center transition-[transform,background-color,border-color,opacity] duration-300 hover:scale-105 active:scale-95 ${
          isDark
            ? "bg-[#1C1630] border-[#9F67FE]/40 shadow-lg shadow-[#9F67FE]/20"
            : "bg-white border-[#eDdedd] shadow-lg shadow-[#480082]/15"
        }`}
      >
        {/* Moon in light mode, sun in dark mode — they swap with a spin */}
        <Moon
          size={20}
          className={`absolute text-[#480082] transition-all duration-500 ${
            isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
          }`}
        />
        <Sun
          size={20}
          className={`absolute text-[#FFB700] transition-all duration-500 ${
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
          }`}
        />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      style={{ color: "var(--text-secondary)" }}
    >
      {icon}
      <span className="flex-1 text-left">Dark mode</span>
      {/* Switch track */}
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${
          isDark ? "bg-[#9F67FE]" : "bg-[#0E0D0D]/15"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
            isDark ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}
