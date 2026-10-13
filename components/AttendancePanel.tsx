"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Loader2, UserCheck, UserX, Users, Search, Radio } from "lucide-react";
import type { CheckInEvent } from "@/components/CheckInScanner";

type AttendeeRow = {
  id: string;
  user_name: string | null;
  user_email: string;
  tier_name: string | null;
  status: string;
  checked_in_at: string | null;
};

// The event a host most likely wants to watch: one happening today/next,
// else the most recent past one. `events` comes in date-descending order.
function defaultEventId(events: CheckInEvent[]): string {
  if (events.length === 0) return "";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = events.filter(e => new Date(e.date) >= startOfToday);
  return (upcoming.length ? upcoming[upcoming.length - 1] : events[0]).id;
}

/**
 * Host-side live attendance for one event: how many ticket holders have been
 * admitted vs. not yet, and who. Scans done anywhere (host phone, door-staff
 * link, admin) arrive over Supabase realtime, so the numbers move on their own.
 */
export default function AttendancePanel({ events }: { events: CheckInEvent[] }) {
  const [pickedId, setPickedId] = useState("");
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [tab, setTab] = useState<"in" | "out">("in");
  const [query, setQuery] = useState("");

  const eventId = pickedId || defaultEventId(events);
  const loading = loadedFor !== eventId;

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const { data } = await fetchAllRows<AttendeeRow>((from, to) => supabase
        .from("tickets")
        .select("id, user_name, user_email, tier_name, status, checked_in_at")
        .eq("event_id", eventId)
        .in("status", ["valid", "scanned"])
        .order("id")
        .range(from, to));
      if (!cancelled) { setRows(data); setLoadedFor(eventId); }
    })();

    const channel = supabase
      .channel(`attendance-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const t = payload.new as AttendeeRow & { event_id: string };
          if (!t?.id) return;
          setRows(prev => {
            const rest = prev.filter(r => r.id !== t.id);
            return t.status === "valid" || t.status === "scanned" ? [...rest, t] : rest;
          });
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [eventId]);

  const checkedIn = useMemo(
    () => rows.filter(r => r.status === "scanned" || r.checked_in_at)
      .sort((a, b) => (b.checked_in_at || "").localeCompare(a.checked_in_at || "")),
    [rows]
  );
  const notIn = useMemo(
    () => rows.filter(r => !(r.status === "scanned" || r.checked_in_at))
      .sort((a, b) => (a.user_name || a.user_email).localeCompare(b.user_name || b.user_email)),
    [rows]
  );
  const total = rows.length;
  const pct = total ? Math.round((checkedIn.length / total) * 100) : 0;

  const q = query.trim().toLowerCase();
  const list = (tab === "in" ? checkedIn : notIn).filter(r =>
    !q || (r.user_name || "").toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q)
  );

  if (events.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto mb-6 rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-theme">Attendance</h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#16a34a" }}>
          <Radio size={12} className="animate-pulse" /> Live
        </span>
      </div>

      <select
        value={eventId}
        onChange={e => { setPickedId(e.target.value); setQuery(""); }}
        className="w-full p-3 rounded-xl text-sm"
        style={{ backgroundColor: "var(--background)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
      >
        {events.map(ev => (
          <option key={ev.id} value={ev.id}>
            {ev.title} — {new Date(ev.date).toLocaleDateString()}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Checked in", value: checkedIn.length, color: "#16a34a", icon: UserCheck },
              { label: "Not yet",    value: notIn.length,     color: "#d97706", icon: UserX },
              { label: "Total",      value: total,            color: "var(--brand-indigo)", icon: Users },
            ].map(s => (
              <div key={s.label} className="rounded-xl py-3" style={{ backgroundColor: "var(--background)" }}>
                <s.icon size={16} className="mx-auto mb-1" style={{ color: s.color }} />
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: "#16a34a" }} />
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{pct}% of ticket holders have arrived</p>
          </div>

          {total > 0 && (
            <>
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
                {([["in", `Checked in (${checkedIn.length})`], ["out", `Not yet (${notIn.length})`]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)}
                    className="flex-1 py-2 text-xs font-semibold transition"
                    style={{
                      backgroundColor: tab === key ? "var(--brand-indigo)" : "transparent",
                      color: tab === key ? "#fff" : "var(--text-secondary)",
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search name or email"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
                />
              </div>

              <ul className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: "var(--card-border)" }}>
                {list.length === 0 ? (
                  <li className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    {q ? "No matches." : tab === "in" ? "No one has checked in yet." : "Everyone is in! 🎉"}
                  </li>
                ) : list.map(r => (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {r.user_name || r.user_email}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {r.tier_name || "Standard"}{r.user_name ? ` · ${r.user_email}` : ""}
                      </p>
                    </div>
                    {r.checked_in_at && (
                      <span className="text-xs shrink-0 font-semibold" style={{ color: "#16a34a" }}>
                        {new Date(r.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
