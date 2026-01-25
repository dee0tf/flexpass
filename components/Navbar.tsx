import Link from "next/link";
import { Menu, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Logo from "./Logo";
import { useRouter } from "next/navigation";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Check if user is logged in and listen for changes
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setMobileMenuOpen(false);
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMobileMenuOpen(false);
    router.push("/login");
    router.refresh(); // Ensure state updates across app
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Desktop */}
          <Link href="/" className="hidden md:block">
            <Logo size={42} />
          </Link>

          {/* Logo - Mobile */}
          <Link href="/" className="md:hidden">
            <Logo type="icon" size={32} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/events"
              className="text-[#0F172A] hover:text-flex-purple transition-colors font-medium"
            >
              Find Events
            </Link>
            <Link
              href="/create"
              className="text-[#0F172A] hover:text-flex-purple transition-colors font-medium"
            >
              Create Event
            </Link>

            {/* CONDITIONAL BUTTONS */}
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="bg-slate-100 text-slate-900 border border-slate-200 px-6 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <User size={18} className="text-[#581c87]" />
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2 font-medium"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-gradient-to-b from-[#f97316] to-[#581c87] text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-[#0F172A] hover:text-flex-purple transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col gap-4">
              <Link
                href="/events"
                className="text-[#0F172A] hover:text-flex-purple transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Find Events
              </Link>
              <Link
                href="/create"
                className="text-[#0F172A] hover:text-flex-purple transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Event
              </Link>

              {/* Mobile Conditional Button */}
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="bg-slate-100 text-slate-900 px-6 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2 w-fit"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User size={18} className="text-[#581c87]" />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-red-600 font-medium flex items-center gap-2 px-6 py-2"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="bg-gradient-to-b from-[#f97316] to-[#581c87] text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity text-center w-fit"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}