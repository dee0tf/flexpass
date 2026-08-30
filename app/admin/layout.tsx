"use client";

import { useAuthGuard } from "@/lib/useAuthGuard";
import { Loader2 } from "lucide-react";

/**
 * Purely a baseline "is there any session at all" gate — each admin page
 * still does its own ADMIN_EMAIL-specific check via /api/admin/check-auth
 * and renders its own "Access Denied" state, unchanged. What this adds is
 * the same soft-redirect-on-SIGNED_OUT and visibility-refresh behavior the
 * dashboard layout has (see lib/useAuthGuard) — without it, a long-idle
 * admin tab (e.g. running the door at an event) only discovered a stale
 * session when the next scan actually failed, instead of before.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthGuard();

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  return <>{children}</>;
}
