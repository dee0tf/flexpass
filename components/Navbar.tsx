"use client";

import Link from "next/link";
import { Menu, X, User, LogOut, Ticket } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Logo from "./Logo";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const isHome = pathname === "/";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") { setMobileMenuOpen(false); router.refresh(); }
      if (event === "SIGNED_IN") { router.refresh(); }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    }
    if (mobileMenuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMobileMenuOpen(false);
    router.push("/login");
    router.refresh();
  };

  const closeMenu = () => setMobileMenuOpen(false);

  // Hero: transparent until scrolled. Other pages: always solid.
  const isTransparent = isHome && !scrolled;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={isTransparent
          ? { background: "transparent" }
          : { backgroundColor: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)", backdropFilter: "blur(14px)" }
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" onClick={closeMenu}>
              <Logo size={44} variant={isTransparent ? "white" : "gradient"} />
            </Link>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="/events"
                className="font-medium text-sm transition-colors"
                style={{ color: isTransparent ? "rgba(255,255,255,0.85)" : "var(--text-secondary)" }}
              >
                Find Events
              </Link>
              <Link href="/create"
                className="font-medium text-sm transition-colors"
                style={{ color: isTransparent ? "rgba(255,255,255,0.85)" : "var(--text-secondary)" }}
              >
                Host an Event
              </Link>
              {user ? (
                <div className="flex items-center gap-3">
                  <Link href="/dashboard"
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: "var(--brand-indigo)" }}
                  >
                    <User size={15} /> Dashboard
                  </Link>
                  <button onClick={handleSignOut} title="Sign Out"
                    className="p-2 rounded-xl transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link href="/login"
                  className="px-5 py-2 rounded-xl font-bold text-sm text-[#0E0D0D] transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-amber)" }}
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileMenuOpen(p => !p)}
              className="md:hidden p-2 rounded-xl transition-colors"
              style={{ color: isTransparent ? "rgba(255,255,255,0.85)" : "var(--text-secondary)" }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />
          <div
            ref={menuRef}
            className="absolute top-0 right-0 h-full w-72 flex flex-col shadow-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
              <Logo size={32} variant="gradient" />
              <button onClick={closeMenu} className="p-2 rounded-xl transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {[
                { href: "/events", label: "Find Events", icon: <Ticket size={17} /> },
                { href: "/create", label: "Host an Event", icon: <span className="text-base">✦</span> },
                ...(user ? [{ href: "/dashboard", label: "Dashboard", icon: <User size={17} /> }] : []),
              ].map(item => (
                <Link key={item.href} href={item.href} onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span style={{ color: "var(--brand-lavender)" }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-4 py-5 space-y-3" style={{ borderTop: "1px solid var(--border-color)" }}>
              {user ? (
                <button onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut size={17} /> Sign Out
                </button>
              ) : (
                <Link href="/login" onClick={closeMenu}
                  className="block w-full text-center py-3 rounded-xl font-bold text-sm text-[#0E0D0D] hover:opacity-90 transition-colors"
                  style={{ backgroundColor: "var(--brand-amber)" }}
                >
                  Sign In
                </Link>
              )}
              <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Tap, Flex, Enter, Repeat.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
