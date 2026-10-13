"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Wallet, Settings, LogOut, Menu, X, ScanLine, TicketIcon, BadgeCheck, Share2, BookOpen, ShieldCheck, BarChart3, Loader2, UserCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useRef } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogoPopup from "@/components/BrandLogoPopup";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading: authLoading } = useAuthGuard();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [checkinAlerts, setCheckinAlerts] = useState<{ id: string; name: string; eventTitle: string; tier: string | null }[]>([]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const userId = session.user.id;

      // Only the FlexPass admin account gets a link back to /admin — everyone
      // else on this dashboard is a regular host with no admin access.
      fetch("/api/admin/check-auth", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(res => setIsAdminUser(res.ok)).catch(() => setIsAdminUser(false));

      // Check verified status
      const { data } = await supabase
        .from("events")
        .select("organizer_verified")
        .eq("user_id", userId)
        .eq("organizer_verified", true)
        .limit(1);
      setIsVerified((data?.length || 0) > 0);

      const { data: myEvents } = await supabase
        .from("events")
        .select("id, title")
        .eq("user_id", userId);
      if (!myEvents || myEvents.length === 0) return;

      const eventIds = new Set(myEvents.map(e => e.id));
      const titleMap: Record<string, string> = Object.fromEntries(myEvents.map(e => [e.id, e.title]));
      const canNotify = () =>
        typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
      const announced = new Set<string>();

      // Clean up any previous channel
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
      }

      type TicketRow = {
        id: string; event_id: string; status: string; checked_in_at: string | null;
        user_name: string | null; user_email: string; tier_name: string | null;
      };

      // New sale — browser notification only
      const onInsert = (ticket: TicketRow) => {
        if (!eventIds.has(ticket.event_id) || !canNotify()) return;
        const eventTitle = titleMap[ticket.event_id] || "your event";
        const tierLabel = ticket.tier_name && ticket.tier_name !== "Standard"
          ? ` (${ticket.tier_name})`
          : "";
        new Notification("🎟️ New ticket sold!", {
          body: `${ticket.user_name || ticket.user_email} just bought a ticket to ${eventTitle}${tierLabel}.`,
          icon: "/icon.png",
          tag: ticket.id,
        });
      };

      // Check-in — /api/checkin flips status to 'scanned' and stamps
      // checked_in_at. Only announce fresh scans, once per ticket, so an
      // unrelated later update to an old scanned ticket stays quiet.
      const onUpdate = (ticket: TicketRow) => {
        if (!eventIds.has(ticket.event_id) || ticket.status !== "scanned" || !ticket.checked_in_at) return;
        if (announced.has(ticket.id)) return;
        if (Date.now() - new Date(ticket.checked_in_at).getTime() > 2 * 60 * 1000) return;
        announced.add(ticket.id);

        const name = ticket.user_name || ticket.user_email;
        const eventTitle = titleMap[ticket.event_id] || "your event";
        const tier = ticket.tier_name && ticket.tier_name !== "Standard" ? ticket.tier_name : null;
        setCheckinAlerts(prev => [...prev.slice(-3), { id: ticket.id, name, eventTitle, tier }]);
        setTimeout(() => setCheckinAlerts(prev => prev.filter(a => a.id !== ticket.id)), 6000);

        // Tab in the background — fall back to a system notification
        if (canNotify() && document.visibilityState !== "visible") {
          new Notification("✅ Checked in", {
            body: `${name} just checked in to ${eventTitle}${tier ? ` (${tier})` : ""}.`,
            icon: "/icon.png",
            tag: `checkin-${ticket.id}`,
          });
        }
      };

      // Filter server-side by this host's own event IDs, so realtime never
      // even delivers another host's ticket rows to this browser. Realtime
      // caps an `in` filter at 100 values, hence the chunks.
      const ids = [...eventIds];
      let channel = supabase.channel(`host-ticket-notifications-${userId}`);
      for (let i = 0; i < ids.length; i += 100) {
        const filter = `event_id=in.(${ids.slice(i, i + 100).join(",")})`;
        channel = channel
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets", filter }, (p) => onInsert(p.new as TicketRow))
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter }, (p) => onUpdate(p.new as TicketRow));
      }
      channel.subscribe();

      notifChannelRef.current = channel;
    })();

    return () => {
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
      }
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Covers every /dashboard route from one place — see lib/useAuthGuard for
  // why this used to be ~9 separate, inconsistent per-page checks instead.
  // Blocking on this (rather than rendering the shell around a null
  // session) avoids a flash of sidebar/nav for a visitor who's about to be
  // redirected to /login anyway.
  if (authLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  const navItems = [
    { name: "Overview",   href: "/dashboard",           icon: LayoutDashboard },
    { name: "My Events",  href: "/dashboard/events",     icon: CalendarDays },
    { name: "Analytics",  href: "/dashboard/analytics", icon: BarChart3, isNew: true },
    { name: "My Tickets", href: "/dashboard/tickets",   icon: TicketIcon },
    { name: "Check-In",   href: "/dashboard/checkin",   icon: ScanLine },
    { name: "Promoters",  href: "/dashboard/promoters", icon: Share2 },
    { name: "Wallet",     href: "/dashboard/wallet",    icon: Wallet },
    { name: "Settings",   href: "/dashboard/settings",  icon: Settings },
    { name: "Guide",      href: "/dashboard/guide",     icon: BookOpen },
  ];

  // Build sidebar JSX as a variable (not a component) to avoid React unmounting/remounting
  // on every re-render — defining it as `const Foo = () =>` inside a component creates a new
  // component type each render, causing full subtree unmounts that can trigger error boundaries.
  const sidebarContent = (
    <>
      <div className="p-6" style={{borderBottom:"1px solid var(--sidebar-border)"}}>
        <Logo size={40} variant="gradient" />
        <div className="flex items-center gap-1.5 mt-1.5">
          <p className="text-xs" style={{color:"var(--text-muted)"}}>Host Dashboard</p>
          {isVerified && (
            <span className="flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              <BadgeCheck size={11} /> Verified
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                isActive ? "bg-[#480082] text-white shadow-lg shadow-[#480082]/20" : ""
              }`}
              style={isActive ? {} : { color: "var(--text-secondary)" }}
            >
              <item.icon size={18} />
              {item.name}
              {item.isNew && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full ml-auto shrink-0" style={{ backgroundColor: "var(--brand-amber)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-1" style={{borderTop:"1px solid var(--sidebar-border)"}}>
        {isAdminUser && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors text-sm font-medium"
            style={{ color: "var(--brand-indigo)" }}
          >
            <ShieldCheck size={18} /> Admin Panel
          </Link>
        )}
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl w-full transition-colors text-sm font-medium"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F9F8FF] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed h-full z-10" style={{backgroundColor:"var(--sidebar-bg)",borderRight:"1px solid var(--sidebar-border)"}}>
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 w-full z-20 px-4 h-14 flex justify-between items-center" style={{backgroundColor:"var(--nav-bg)",borderBottom:"1px solid var(--nav-border)",backdropFilter:"blur(12px)"}}>
        <Logo size={36} variant="gradient" />
        <button onClick={() => setMobileOpen(p => !p)} className="p-2 rounded-xl transition-colors" style={{color:"var(--text-secondary)"}}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-64 flex flex-col" style={{backgroundColor:"var(--sidebar-bg)"}}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 min-h-screen w-full min-w-0 overflow-x-hidden" style={{backgroundColor:"var(--background)"}}>
        {children}
        <div className="mt-12 border-t border-[#eDdedd] pt-6 text-center text-xs text-[#0E0D0D]/30">
          &copy; {new Date().getFullYear()} FlexPass — Made with ♥ in Lagos
        </div>
      </main>
      <BrandLogoPopup />

      {/* Live check-in alerts — stacked so a busy door doesn't overwrite them */}
      {checkinAlerts.length > 0 && (
        <div className="fixed top-16 md:top-5 right-4 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
          {checkinAlerts.map(a => (
            <div key={a.id}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm"
              style={{ backgroundColor: "#16a34a", border: "1px solid #15803d", animation: "checkinIn 0.25s ease-out" }}>
              <UserCheck size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{a.name} just checked in</p>
                <p className="text-xs opacity-90 truncate">{a.eventTitle}{a.tier ? ` · ${a.tier}` : ""}</p>
              </div>
              <button onClick={() => setCheckinAlerts(prev => prev.filter(x => x.id !== a.id))}
                className="shrink-0 opacity-70 hover:opacity-100 transition" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          ))}
          <style>{`@keyframes checkinIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}
