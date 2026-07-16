"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import CheckInScanner, { CheckInEvent } from "@/components/CheckInScanner";

export default function AdminCheckInPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [events, setEvents] = useState<CheckInEvent[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      const res = await fetch("/api/admin/check-auth", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setLoading(false); return; }
      setAuthorized(true);

      const { data } = await supabase
        .from("events")
        .select("id, title, date, organizer_name")
        .order("date", { ascending: false });
      setEvents(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-indigo)" }} />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Access Denied</h1>
          <p style={{ color: "var(--text-muted)" }}>You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <header className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div>
          <h1 className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>Admin Check-In</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Scan tickets for any event on the platform</p>
        </div>
        <Link href="/admin"
          className="text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
          style={{ backgroundColor: "rgba(72,0,130,0.08)", color: "var(--brand-indigo)" }}>
          ← Admin Panel
        </Link>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        <CheckInScanner
          events={events}
          title="Admin Check-In Scanner"
          subtitle="Pick the event you're running the door for, then scan."
        />
      </div>
    </div>
  );
}
