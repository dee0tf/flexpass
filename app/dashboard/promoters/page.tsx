"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Share2, Plus, Copy, Check, X, Loader2, TrendingUp, Ticket, ChevronDown,
} from "lucide-react";

interface Promoter {
  id: string;
  name: string;
  code: string;
  tickets: number;
  revenue: number;
  created_at: string;
}

export default function PromotersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      const { data } = await supabase
        .from("events")
        .select("id, title, date")
        .eq("user_id", session.user.id)
        .order("date", { ascending: false });
      setEvents(data || []);
      if (data?.length === 1) setSelectedEvent(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent || !token) return;
    loadPromoters();
  }, [selectedEvent, token]);

  async function loadPromoters() {
    setLoading(true);
    try {
      const res = await fetch(`/api/promoters?eventId=${selectedEvent}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPromoters(data.promoters || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !selectedEvent) return;
    setAdding(true);
    try {
      const res = await fetch("/api/promoters", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: selectedEvent, name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await loadPromoters();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(promoterId: string) {
    await fetch(`/api/promoters/${promoterId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setPromoters(prev => prev.filter(p => p.id !== promoterId));
  }

  function copyLink(code: string) {
    const eventId = selectedEvent;
    navigator.clipboard.writeText(`${window.location.origin}/events/${eventId}?ref=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const totalTickets = promoters.reduce((s, p) => s + p.tickets, 0);
  const totalRevenue = promoters.reduce((s, p) => s + p.revenue, 0);

  return (
    <div className="max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-theme">Promoter Links</h1>
        <p className="text-theme-2 text-sm mt-0.5">
          Create unique tracking links for each promoter. See exactly how many tickets each one drives.
        </p>
      </div>

      {/* Event selector */}
      <div className="relative">
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Select Event
        </label>
        <div className="relative">
          <select
            value={selectedEvent}
            onChange={e => { setSelectedEvent(e.target.value); setPromoters([]); }}
            className="w-full p-3 pr-10 rounded-xl text-sm appearance-none"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
          >
            <option value="">— choose an event —</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.title} — {new Date(ev.date).toLocaleDateString()}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-3.5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {selectedEvent && (
        <>
          {/* Summary cards */}
          {promoters.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Ticket size={15} style={{ color: "var(--brand-indigo)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total via Promoters</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{totalTickets}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>tickets sold</p>
              </div>
              <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={15} style={{ color: "#16a34a" }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Revenue via Promoters</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                  ₦{totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>across {promoters.length} promoter{promoters.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          )}

          {/* Add promoter */}
          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Add Promoter</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Promoter name (e.g. Kemi, Tunde Lagos)"
                className="flex-1 p-3 rounded-xl text-sm focus:outline-none focus:ring-2 transition"
                style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="px-5 py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: "var(--brand-indigo)" }}>
                {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Each promoter gets a unique link like <span className="font-mono">flexpasshq.com/events/…?ref=kemi42</span> — share it with them directly.
            </p>
          </div>

          {/* Promoters list */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                Leaderboard
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} />
              </div>
            ) : promoters.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Share2 className="h-10 w-10 mx-auto opacity-20" style={{ color: "var(--text-primary)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>No promoters yet</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Add one above and share the link with them.</p>
              </div>
            ) : (
              <div>
                {[...promoters].sort((a, b) => b.tickets - a.tickets).map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--card-border)" }}
                  >
                    {/* Rank */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: i === 0 ? "rgba(72,0,130,0.12)" : "var(--surface-raised)",
                        color: i === 0 ? "var(--brand-indigo)" : "var(--text-muted)",
                      }}>
                      {i + 1}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                      <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>?ref={p.code}</p>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm" style={{ color: p.tickets > 0 ? "var(--brand-indigo)" : "var(--text-muted)" }}>
                        {p.tickets} ticket{p.tickets !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {p.revenue > 0 ? `₦${p.revenue.toLocaleString()}` : "—"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copyLink(p.code)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80"
                        style={{
                          backgroundColor: copiedCode === p.code ? "rgba(22,163,74,0.12)" : "rgba(72,0,130,0.08)",
                          color: copiedCode === p.code ? "#16a34a" : "var(--brand-indigo)",
                        }}>
                        {copiedCode === p.code ? <Check size={12} /> : <Copy size={12} />}
                        {copiedCode === p.code ? "Copied!" : "Copy"}
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg transition hover:bg-red-50 text-red-400 hover:text-red-600">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
