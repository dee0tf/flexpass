"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const PROPERTY_ID = process.env.NEXT_PUBLIC_TAWKTO_PROPERTY_ID;
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWKTO_WIDGET_ID;
// Once dismissed, the "How can we help?" bubble stays away for the rest of
// the visit (it still shows on hover/focus).
const GREETING_DISMISSED_KEY = "fp_chat_greeting_dismissed";
const GREETING_DELAY_MS = 2500;
// Literal on purpose: there is no --brand-gold CSS variable defined in
// globals.css, so var(--brand-gold) silently renders as nothing.
const BRAND_GOLD = "#FFB700";

// Cloud silhouette: [cx, cy, r] puffs around a rounded body (see the SVG
// below), uneven on purpose so it reads as a cloud rather than a pill.
const CLOUD_PUFFS: [number, number, number][] = [
  [26, 64, 20], [44, 46, 22], [80, 32, 27], [120, 27, 28], [158, 38, 24],
  [184, 60, 19], [62, 84, 17], [104, 88, 17], [148, 84, 17],
];

// Cloud bubble motion: a slow drift, and gold "typing" dots. Both switch off
// for visitors who prefer reduced motion.
const CLOUD_KEYFRAMES = `
@keyframes fp-cloud-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes fp-cloud-dot { 0%, 60%, 100% { opacity: 0.35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
.fp-cloud-float { animation: fp-cloud-float 3.2s ease-in-out infinite; }
.fp-cloud-dot { animation: fp-cloud-dot 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .fp-cloud-float, .fp-cloud-dot { animation: none; } }
`;

type TawkVisitor = { name?: string; email?: string };

type TawkAPI = {
  visitor?: TawkVisitor;
  onLoad?: () => void;
  // Deliberately omits onChatMaximized/onChatMinimized: this widget build
  // doesn't fire them for programmatic maximize(), so the poll below is what
  // tracks open/closed instead.
  onChatMessageAgent?: () => void;
  onChatMessageSystem?: () => void;
  showWidget?: () => void;
  hideWidget?: () => void;
  maximize?: () => void;
  isChatMaximized?: () => boolean;
  isChatHidden?: () => boolean;
  setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkAPI;
    Tawk_LoadStart?: Date;
  }
}

// The FlexPass "F" mark from public/favicon.svg — letterform in white, ticket
// perforations in brand gold — so the launcher reads as ours, not a generic
// chat bubble. viewBox is cropped to the mark so it sits centred in the circle.
function FlexPassMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="5 7 50 50" aria-hidden>
      <circle cx="12" cy="20" r="3.5" fill={BRAND_GOLD} />
      <circle cx="12" cy="32" r="3.5" fill={BRAND_GOLD} />
      <circle cx="12" cy="44" r="3.5" fill={BRAND_GOLD} />
      <rect x="18" y="14" width="34" height="9" rx="2" fill="#fff" />
      <rect x="18" y="14" width="9" height="36" rx="2" fill="#fff" />
      <rect x="18" y="28" width="26" height="8" rx="2" fill="#fff" />
    </svg>
  );
}

// Flags <html data-chat-open> while the chat is opening or open, so other
// floating UI (the theme button) can step aside. See .fp-theme-fab in globals.css.
function setChatBusy(busy: boolean) {
  document.documentElement.toggleAttribute("data-chat-open", busy);
}

export default function TawkToWidget() {
  const pathname = usePathname();

  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [greeting, setGreeting] = useState(false);

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover)").matches);
  }, []);

  // Greeting bubble: pops in shortly after the page settles, unless the
  // visitor already dismissed it this session.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(GREETING_DISMISSED_KEY) === "1";
    } catch {
      // Storage blocked — just show it.
    }
    if (dismissed) return;
    const t = setTimeout(() => setGreeting(true), GREETING_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function dismissGreeting() {
    setGreeting(false);
    try {
      sessionStorage.setItem(GREETING_DISMISSED_KEY, "1");
    } catch {
      // Non-critical.
    }
  }

  // Refs, not state: these are read from Tawk callbacks and timers registered
  // once before the script loads, which would otherwise close over the first
  // render's values forever.
  const injectedRef = useRef(false);
  const pendingOpenRef = useRef(false);
  const openRef = useRef(false);
  const visitorRef = useRef<TawkVisitor | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while openChat() is mid-way through showWidget -> maximize, so the
  // hide-enforcement poll doesn't fight it and re-hide the widget.
  const openingRef = useRef(false);

  // Tawk silently drops maximize() when it lands before the widget frame has
  // been re-attached by showWidget() — which is always, if both run in the
  // same tick. Retry until isChatMaximized() says the panel is actually up.
  const openChat = useCallback(() => {
    const api = window.Tawk_API;
    if (!api) return;
    openingRef.current = true;
    api.showWidget?.();

    let attempts = 0;
    const attempt = () => {
      if (api.isChatMaximized?.() || attempts >= 8) {
        openingRef.current = false;
        return;
      }
      attempts++;
      api.maximize?.();
      openTimerRef.current = setTimeout(attempt, 250);
    };
    openTimerRef.current = setTimeout(attempt, 150);
  }, []);

  // Injects the Tawk script exactly once — called either by the idle preload
  // below or by the first click on our launcher, whichever happens first.
  const ensureLoaded = useCallback(() => {
    if (injectedRef.current) return;
    injectedRef.current = true;
    setStatus("loading");

    const api: TawkAPI = (window.Tawk_API = window.Tawk_API || {});
    window.Tawk_LoadStart = new Date();

    // Must be set *before* the script runs for Tawk to prefill the pre-chat form.
    if (visitorRef.current) api.visitor = visitorRef.current;

    api.onLoad = () => {
      setStatus("ready");
      if (pendingOpenRef.current) {
        pendingOpenRef.current = false;
        openChat();
      } else {
        // We render our own launcher, so Tawk's default bubble stays hidden
        // until the visitor actually opens a chat.
        api.hideWidget?.();
      }
      // The session may have resolved after injection — this is the late path.
      if (visitorRef.current?.email) {
        api.setAttributes?.({
          name: visitorRef.current.name || "",
          email: visitorRef.current.email,
        });
      }
    };

    // Agent replies and proactive triggers both land on a hidden widget, so
    // our badge is the only thing telling the visitor someone's waiting.
    const notify = () => {
      if (!api.isChatMaximized?.()) setUnread((n) => n + 1);
    };
    api.onChatMessageAgent = notify;
    api.onChatMessageSystem = notify;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.head.appendChild(s);
  }, [openChat]);

  // Resolve the signed-in user first so support sees who they're talking to,
  // then preload the script once the browser is idle. Loading it off the
  // critical path keeps it out of the homepage/events Total Blocking Time
  // while still letting Tawk's proactive triggers fire.
  useEffect(() => {
    if (!PROPERTY_ID || !WIDGET_ID) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (user) {
          visitorRef.current = {
            name: (user.user_metadata?.full_name as string) || user.email || "FlexPass visitor",
            email: user.email,
          };
        }
      } catch {
        // Not signed in / auth unavailable — chat still works anonymously.
      }
      if (cancelled) return;

      const preload = () => {
        if (!cancelled) ensureLoaded();
      };
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(preload, { timeout: 8000 });
      } else {
        timeoutHandle = setTimeout(preload, 5000);
      }
    })();

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, [ensureLoaded]);

  // Tawk's onChatMaximized/onChatMinimized callbacks don't fire for
  // programmatic maximize() on this widget build, so poll the one signal that
  // is reliable. This is the only thing that knows when to duck our launcher
  // out of the panel's way, and when to tuck Tawk's own bubble back away.
  useEffect(() => {
    if (status !== "ready") return;

    const id = setInterval(() => {
      const api = window.Tawk_API;
      const maximized = !!api?.isChatMaximized?.();

      // Whenever the panel isn't open, Tawk's own bubble must stay hidden —
      // our launcher replaces it. Enforced every tick rather than once on
      // minimize, because Tawk ignores a hideWidget() that lands while its
      // minimize animation is still running, leaving its bubble on screen.
      if (!maximized && !openingRef.current && !api?.isChatHidden?.()) {
        api?.hideWidget?.();
      }

      if (maximized === openRef.current) return;
      openRef.current = maximized;
      setOpen(maximized);
      setChatBusy(maximized);
      if (maximized) setUnread(0);
    }, 400);

    return () => clearInterval(id);
  }, [status]);

  function handleClick() {
    // Clear the floating theme button out of the way as soon as the visitor
    // asks for chat, not only once the panel is fully up. If the panel never
    // opens (script blocked, etc.), bring it back.
    setChatBusy(true);
    setTimeout(() => {
      if (!openRef.current) setChatBusy(false);
    }, 10000);
    setUnread(0);
    dismissGreeting();
    if (status === "ready") {
      openChat();
      return;
    }
    // Script still in flight (or never started) — open as soon as it lands.
    pendingOpenRef.current = true;
    ensureLoaded();
  }

  if (!PROPERTY_ID || !WIDGET_ID) return null;

  // The event detail page parks a fixed checkout card in the bottom-right on
  // desktop and a sticky buy bar along the bottom on mobile. Step around both
  // rather than letting the launcher get buried under them.
  const isEventDetail = /^\/events\/[^/]+$/.test(pathname ?? "");
  const position = isEventDetail
    ? "bottom-24 right-4 md:bottom-10 md:right-[23.5rem]"
    : "bottom-24 right-4 md:bottom-6 md:right-6";

  // Hover/press states are driven from React rather than group-hover utilities:
  // the arbitrary `[@media(hover:hover)]:` variants this needs aren't emitted
  // into the stylesheet, and `canHover` keeps touch devices from latching into
  // a stuck hover state after a tap (the same trap documented in ThemeToggle).
  const active = (hovered || focused) && canHover;

  const showBubble = !open && (greeting || active || unread > 0);

  return (
    <div
      className={`fixed ${position} z-50`}
      // Tawk's own chat window owns the corner while it's open.
      style={{
        opacity: open ? 0 : 1,
        transform: open ? "translateY(0.5rem)" : "none",
        pointerEvents: open ? "none" : "auto",
        transition: "opacity 300ms ease, transform 300ms ease",
      }}
    >
      <style>{CLOUD_KEYFRAMES}</style>

      {/* "How can we help?" cloud — pops in above the launcher after a
          moment (and on hover/focus once dismissed), drifts gently, and
          trails two puffs down to the button like a thought bubble.
          Clicking it opens the chat. */}
      <div
        className="absolute bottom-[calc(100%+1.6rem)] right-0"
        style={{
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? "translateY(0) scale(1)" : "translateY(0.75rem) scale(0.6)",
          transformOrigin: "85% 100%",
          pointerEvents: showBubble ? "auto" : "none",
          transition: showBubble
            ? "opacity 250ms ease, transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)"
            : "opacity 200ms ease, transform 200ms ease",
        }}
        aria-hidden={!showBubble}
      >
        <div className="fp-cloud-float relative">
          <button
            type="button"
            onClick={handleClick}
            tabIndex={showBubble ? 0 : -1}
            className="relative block h-[108px] w-[208px] text-white"
            style={{ filter: "drop-shadow(0 10px 22px rgba(72, 0, 130, 0.45))" }}
          >
            <svg
              viewBox="0 0 208 108"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              <defs>
                <linearGradient id="fp-cloud-fill" x1="0" y1="0" x2="208" y2="108" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="var(--brand-indigo-hover)" />
                  <stop offset="100%" stopColor="var(--brand-indigo)" />
                </linearGradient>
                <linearGradient id="fp-cloud-sheen" x1="0" y1="0" x2="0" y2="108" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="fp-cloud-clip">
                  {CLOUD_PUFFS.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
                  <rect x="16" y="42" width="176" height="44" rx="22" />
                </clipPath>
              </defs>
              {/* Body + puffs share one fill so they merge into one cloud */}
              <g fill="url(#fp-cloud-fill)">
                {CLOUD_PUFFS.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
                <rect x="16" y="42" width="176" height="44" rx="22" />
              </g>
              {/* One highlight clipped to the whole silhouette — no seams */}
              <rect x="0" y="0" width="208" height="108" fill="url(#fp-cloud-sheen)" clipPath="url(#fp-cloud-clip)" />
            </svg>

            <span className="relative flex h-full flex-col items-center justify-center pt-4">
              <span className="font-display text-[15px] font-semibold tracking-wide">
                {unread > 0 ? "You have a new message" : "How can we help?"}
              </span>
              <span className="mt-1.5 flex gap-1.5" aria-hidden>
                {[0, 160, 320].map((delay) => (
                  <span
                    key={delay}
                    className="fp-cloud-dot block rounded-full"
                    style={{ width: 6, height: 6, backgroundColor: BRAND_GOLD, animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </span>
          </button>

          {/* Thought-bubble puffs trailing down to the launcher */}
          <span
            className="absolute -bottom-3 right-[30px] h-3.5 w-3.5 rounded-full"
            style={{ backgroundImage: "linear-gradient(135deg, var(--brand-indigo-hover), var(--brand-indigo))" }}
            aria-hidden
          />
          <span
            className="absolute -bottom-[1.45rem] right-[22px] h-2 w-2 rounded-full"
            style={{ backgroundImage: "linear-gradient(135deg, var(--brand-indigo-hover), var(--brand-indigo))" }}
            aria-hidden
          />

          <button
            type="button"
            onClick={dismissGreeting}
            tabIndex={showBubble ? 0 : -1}
            aria-label="Dismiss chat greeting"
            className="absolute left-2 top-7 flex h-6 w-6 items-center justify-center rounded-full border transition hover:scale-110"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--text-muted)",
              boxShadow: "0 4px 12px var(--card-shadow)",
            }}
          >
            <X size={12} aria-hidden />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        aria-label={
          unread > 0
            ? `Open live chat, ${unread} new message${unread > 1 ? "s" : ""}`
            : "Open live chat with FlexPass support"
        }
        className="relative flex-shrink-0"
      >
        {/* Attention ring — only pulses when someone is waiting on a reply. */}
        {unread > 0 && (
          <span
            className="absolute inset-0 animate-ping rounded-full"
            style={{ backgroundColor: BRAND_GOLD, opacity: 0.35 }}
          />
        )}

        {/* Soft brand glow behind the button */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: "var(--brand-indigo)",
            filter: "blur(10px)",
            opacity: active ? 0.7 : 0.4,
            transition: "opacity 300ms ease",
          }}
        />

        <span
          className="relative flex h-14 w-14 items-center justify-center rounded-full border text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--brand-indigo), var(--brand-indigo-hover))",
            borderColor: "rgba(255, 255, 255, 0.18)",
            boxShadow: "0 10px 30px var(--card-shadow)",
            transform: `scale(${pressed ? 0.95 : active ? 1.05 : 1})`,
            transition: "transform 300ms ease",
          }}
        >
          {status === "loading" ? (
            <Loader2 size={24} className="animate-spin" aria-hidden />
          ) : (
            <FlexPassMark size={28} />
          )}

          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none"
              style={{ backgroundColor: BRAND_GOLD, color: "#0E0D0D" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
