"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Wallet, Settings, LogOut, Menu, X, ScanLine, TicketIcon, BadgeCheck, Share2, BookOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("events")
        .select("organizer_verified")
        .eq("user_id", session.user.id)
        .eq("organizer_verified", true)
        .limit(1);
      setIsVerified((data?.length || 0) > 0);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Overview",   href: "/dashboard",           icon: LayoutDashboard },
    { name: "My Events",  href: "/dashboard/events",     icon: CalendarDays },
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
            </Link>
          );
        })}
      </nav>

      <div className="p-4" style={{borderTop:"1px solid var(--sidebar-border)"}}>
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
      <ThemeToggle />
    </div>
  );
}
