"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Wallet, Settings, LogOut, Menu, X, ScanLine
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Overview",  href: "/dashboard",            icon: LayoutDashboard },
    { name: "My Events", href: "/dashboard/events",     icon: CalendarDays },
    { name: "Check-In",  href: "/dashboard/checkin",    icon: ScanLine },
    { name: "Wallet",    href: "/dashboard/wallet",     icon: Wallet },
    { name: "Settings",  href: "/dashboard/settings",   icon: Settings },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6" style={{borderBottom:"1px solid var(--sidebar-border)"}}>
        <Logo size={40} variant="gradient" />
        <p className="text-xs text-[#0E0D0D]/40 mt-1.5">Host Dashboard</p>
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
                isActive
                  ? "bg-[#480082] text-white shadow-lg shadow-[#480082]/20"
                  : "text-[#0E0D0D]/60 hover:bg-[#F9F8FF] hover:text-[#480082]"
              }`}
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
          className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl w-full transition-colors text-sm font-medium"
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
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 w-full z-20 px-4 h-14 flex justify-between items-center" style={{backgroundColor:"var(--nav-bg)",borderBottom:"1px solid var(--nav-border)",backdropFilter:"blur(12px)"}}>
        <Logo size={36} variant="gradient" />
        <button onClick={() => setMobileOpen(p => !p)} className="p-2 rounded-xl hover:bg-[#F9F8FF] text-[#0E0D0D]/60 transition-colors">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-64 flex flex-col" style={{backgroundColor:"var(--sidebar-bg)"}}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 min-h-screen" style={{backgroundColor:"var(--background)"}}>
        {children}
        <div className="mt-12 border-t border-[#eDdedd] pt-6 text-center text-xs text-[#0E0D0D]/30">
          &copy; {new Date().getFullYear()} FlexPass — Made with ♥ in Lagos
        </div>
      </main>
      <ThemeToggle />
    </div>
  );
}
