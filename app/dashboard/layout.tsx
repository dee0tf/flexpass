"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Events", href: "/dashboard/events", icon: CalendarDays },
    { name: "Wallet", href: "/dashboard/wallet", icon: Wallet },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#f97316] to-[#581c87] bg-clip-text text-transparent">
            FlexPass
          </h1>
          <p className="text-xs text-slate-500 mt-1">Host Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                    ? "bg-[#581c87] text-white shadow-lg shadow-purple-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center">
        <span className="font-bold text-[#581c87]">FlexPass Dashboard</span>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)}>
          <Menu className="text-slate-600" />
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0">
        {children}

        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} FlexPass. Made with ❤️ in Lagos.</p>
        </div>
      </main>
    </div>
  );
}