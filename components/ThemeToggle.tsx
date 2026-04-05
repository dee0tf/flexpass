"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  // On mount: read saved preference or system preference
  useEffect(() => {
    const saved = localStorage.getItem("fp-theme") as "light" | "dark" | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial = saved ?? preferred;
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  function applyTheme(t: "light" | "dark") {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = t;
  }

  function toggle() {
    if (animating) return;
    const next = theme === "light" ? "dark" : "light";
    setAnimating(true);
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("fp-theme", next);
    setTimeout(() => setAnimating(false), 400);
  }

  // Avoid hydration flash — render nothing until mounted
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="fixed bottom-6 right-6 z-50 group"
    >
      {/* Outer ring — subtle glow */}
      <span className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
        isDark
          ? "bg-[#9F67FE]/20 opacity-100 blur-md scale-110"
          : "bg-[#480082]/10 opacity-0 group-hover:opacity-100 blur-sm"
      }`} />

      {/* Button body */}
      <span className={`relative flex items-center gap-2.5 px-4 py-3 rounded-2xl border font-medium text-sm shadow-lg transition-all duration-300 ${
        isDark
          ? "bg-[#1C1630] border-[#9F67FE]/30 text-[#F0EEF8] shadow-[#480082]/30 hover:border-[#9F67FE]/60"
          : "bg-white border-[#eDdedd] text-[#0E0D0D] shadow-[#480082]/8 hover:border-[#480082]/30"
      }`}>
        {/* Icon with pop animation */}
        <span className={animating ? "animate-theme-pop" : ""}>
          {isDark
            ? <Sun size={16} className="text-[#FFB700]" />
            : <Moon size={16} className="text-[#480082]" />
          }
        </span>
        <span className={isDark ? "text-[#F0EEF8]/80" : "text-[#0E0D0D]/70"}>
          {isDark ? "Light" : "Dark"}
        </span>

        {/* Active dot */}
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
          isDark ? "bg-[#9F67FE]" : "bg-[#480082]/30"
        }`} />
      </span>
    </button>
  );
}
