"use client";

import { useEffect, useState, useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, TrendingUp, Ticket, Percent, Wallet, MousePointerClick, Gauge,
  Share2, ScanLine, ChevronDown, ArrowUpRight,
} from "lucide-react";
import EventPaceChip from "@/components/EventPaceChip";
import MomentumChart from "@/components/analytics/MomentumChart";
import GenderDonut from "@/components/analytics/GenderDonut";
import FunnelBars from "@/components/analytics/FunnelBars";
import Link from "next/link";
import { PaceStatus } from "@/lib/eventPacing";

type Range = "7" | "30" | "90" | "all";

interface EventSummary {
  id: string; title: string; date: string;
  sold: number; capacity: number; sellThroughPct: number;
  revenue: number; pace: PaceStatus; velocity7d: number; velocityPrior7d: number;
  daysUntilEvent: number | null;
  checkoutInitiated: number; checkoutCompleted: number; conversionPct: number | null;
}

interface AnalyticsData {
  scope: string; range: string;
  events: EventSummary[];
  kpis: {
    revenue: number; ticketsSold: number; capacity: number; sellThroughPct: number;
    checkoutOpened: number; checkoutInitiated: number; checkoutCompleted: number;
    conversionPct: number | null; avgOrderValue: number; pace: PaceStatus | null;
  };
  momentum: { date: string; tickets: number }[];
  funnel: { opened: number; initiated: number; completed: number };
  sources: { name: string; tickets: number; revenue: number }[];
  tiers: { name: string; sold: number; capacity: number; revenue: number }[];
  audience: {
    gender: { female: number; male: number; other: number; totalCounted: number };
    newVsReturning: { newPct: number; returningPct: number; totalBuyers: number };
    showUpRate: { pct: number; sampleSize: number } | null;
  };
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7", label: "7D" }, { value: "30", label: "30D" },
  { value: "90", label: "90D" }, { value: "all", label: "All" },
];

const card: CSSProperties = { backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" };

function trafficColor(index: number) {
  const palette = ["var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)", "var(--chart-cat-4)", "var(--chart-cat-5)"];
  return palette[index % palette.length];
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [token, setToken] = useState<string>("");
  const [events, setEvents] = useState<{ id: string; title: string; date: string }[]>([]);
  const [scope, setScope] = useState<string>("all");
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSession = () => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (cancelled) return;
        if (!session) { window.location.replace("/login"); return; }
        setToken(session.access_token);
        const { data: myEvents } = await supabase
          .from("events").select("id, title, date")
          .eq("user_id", session.user.id).order("date", { ascending: false });
        if (cancelled) return;
        setEvents(myEvents || []);
        setLoading(false);
      });
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) checkSession(); };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const loadAnalytics = useCallback(async (tok: string, evId: string, rng: Range) => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/dashboard/analytics?eventId=${evId}&range=${rng}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadAnalytics(token, scope, range);
  }, [token, scope, range, loadAnalytics]);

  const stableSourceColor = useMemo(() => {
    if (!data) return new Map<string, string>();
    const alpha = [...data.sources].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, string>();
    alpha.forEach((s, i) => map.set(s.name, trafficColor(i)));
    return map;
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-[#480082]" />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading analytics…</p>
    </div>
  );

  if (events.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--card-bg)", border: "2px dashed var(--card-border)" }}>
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(72,0,130,0.08)" }}>
          <TrendingUp className="h-8 w-8" style={{ color: "var(--brand-indigo)" }} />
        </div>
        <h3 className="text-xl font-bold mb-2 text-theme">No analytics yet</h3>
        <p className="text-theme-2 text-sm mb-6 max-w-sm mx-auto">Create your first event to start seeing sales momentum, checkout conversion, and audience insights here.</p>
        <Link href="/create">
          <button className="px-8 py-3 rounded-xl font-bold text-white hover:opacity-90 transition" style={{ backgroundColor: "var(--brand-indigo)" }}>
            Create Event
          </button>
        </Link>
      </div>
    );
  }

  const kpis = data?.kpis;
  const fmtNaira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-5 sm:space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-theme">Analytics</h1>
          <p className="text-theme-2 text-sm mt-0.5 max-w-md">See what&apos;s driving ticket sales, and where people drop off before they buy.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <select
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="w-full sm:w-auto appearance-none pr-9 pl-3 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
            >
              <option value="all">All events</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} — {new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="inline-flex p-1 rounded-xl gap-0.5 self-start sm:self-auto" style={{ backgroundColor: "var(--surface-raised)", border: "1px solid var(--card-border)" }}>
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                style={range === opt.value
                  ? { backgroundColor: "var(--card-bg)", color: "var(--brand-indigo)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }
                  : { color: "var(--text-secondary)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-indigo)" }} /></div>
      ) : kpis && (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ opacity: dataLoading ? 0.6 : 1, transition: "opacity .15s" }}>
            <KpiTile icon={<Wallet size={16} />} iconColor="#16a34a" iconBg="rgba(22,163,74,0.1)" label="Gross revenue" value={fmtNaira(kpis.revenue)} />
            <KpiTile icon={<Ticket size={16} />} iconColor="var(--brand-indigo)" iconBg="rgba(159,103,254,0.12)" label="Tickets sold" value={kpis.ticketsSold.toLocaleString()}
              sub={kpis.capacity > 0 ? `${kpis.sellThroughPct}% of ${kpis.capacity.toLocaleString()} capacity` : undefined} />
            <KpiTile icon={<Percent size={16} />} iconColor="var(--brand-indigo)" iconBg="rgba(159,103,254,0.12)" label="Checkout conversion" newBadge
              value={kpis.conversionPct !== null ? `${kpis.conversionPct}%` : "—"}
              sub={kpis.checkoutInitiated > 0 ? `${kpis.checkoutCompleted} of ${kpis.checkoutInitiated} completed` : "No checkouts started yet"} />
            <KpiTile icon={<TrendingUp size={16} />} iconColor="#b9740a" iconBg="rgba(255,183,0,0.15)" label="Avg. order value" value={fmtNaira(kpis.avgOrderValue)} />
            <KpiTile icon={<MousePointerClick size={16} />} iconColor="#0ea5e9" iconBg="rgba(14,165,233,0.1)" label="Checkout opens" value={kpis.checkoutOpened.toLocaleString()} sub="people who reached checkout" />
            <div className="rounded-2xl p-4" style={card}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: "rgba(72,0,130,0.1)", color: "var(--brand-indigo)" }}><Gauge size={16} /></div>
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Sales pace</span>
              </div>
              {scope !== "all" && kpis.pace ? (
                <EventPaceChip status={kpis.pace} />
              ) : (
                <PaceSummary events={data.events} />
              )}
            </div>
          </div>

          {/* ── Momentum + Funnel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme">Sales momentum</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-2">Daily tickets sold {range !== "all" ? `· last ${range} days` : ""}</p>
              <MomentumChart data={data.momentum.map(m => ({ date: m.date, value: m.tickets }))} />
            </div>

            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-theme">Checkout funnel</h3>
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(159,103,254,0.14)", color: "var(--brand-indigo)" }}>New</span>
              </div>
              <p className="text-theme-2 text-xs mt-0.5 mb-4">Where buyers drop off before paying</p>
              <FunnelBars funnel={data.funnel} />
            </div>
          </div>

          {/* ── Sources + Tiers ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme">Where your buyers come from</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-4">Tickets sold by channel {range !== "all" ? `· last ${range} days` : ""}</p>
              {data.sources.length === 0 ? (
                <EmptyNote text="No ticket sales in this window yet." />
              ) : (
                <div className="space-y-3">
                  {data.sources.map(s => {
                    const max = Math.max(...data.sources.map(x => x.tickets));
                    const pct = max > 0 ? Math.round((s.tickets / max) * 100) : 0;
                    const color = stableSourceColor.get(s.name) || "var(--brand-lavender)";
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-semibold truncate text-theme">{s.name}</span>
                          </div>
                          <span className="text-xs shrink-0 text-theme-2 tabular-nums">
                            <b className="text-theme">{s.tickets}</b> · {fmtNaira(s.revenue)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-raised)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/dashboard/promoters" className="inline-flex items-center gap-1 text-xs font-bold mt-4" style={{ color: "var(--brand-indigo)" }}>
                <Share2 size={12} /> Manage promoter links <ArrowUpRight size={12} />
              </Link>
            </div>

            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme">Ticket tier performance</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-4">Sold vs. available by tier</p>
              {scope === "all" ? (
                <EmptyNote text="Select a single event above to see its tier breakdown." />
              ) : data.tiers.length === 0 ? (
                <EmptyNote text="This event has no ticket tiers yet." />
              ) : (
                <div className="space-y-4">
                  {data.tiers.map(t => {
                    const totalRevenue = data.tiers.reduce((s, x) => s + x.revenue, 0);
                    const revShare = totalRevenue > 0 ? Math.round((t.revenue / totalRevenue) * 100) : 0;
                    const fillPct = t.capacity > 0 ? Math.min(100, Math.round((t.sold / t.capacity) * 100)) : 0;
                    return (
                      <div key={t.name}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-theme">{t.name}</span>
                          <span className="text-xs text-theme-2">{t.sold} / {t.capacity || "—"}</span>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden mt-1.5" style={{ backgroundColor: "rgba(159,103,254,0.12)" }}>
                          <div className="h-full rounded-full" style={{ width: `${fillPct}%`, backgroundColor: "var(--brand-lavender)" }} />
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{fmtNaira(t.revenue)} · {revShare}% of revenue</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Audience insights ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme text-sm">Gender split</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-3">Ticket buyers in this scope</p>
              <GenderDonut
                female={data.audience.gender.female}
                male={data.audience.gender.male}
                other={data.audience.gender.other}
                total={data.audience.gender.totalCounted}
              />
            </div>

            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme text-sm">New vs. returning buyers</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-3">{range !== "all" ? `Last ${range} days` : "All time"}</p>
              {data.audience.newVsReturning.totalBuyers === 0 ? (
                <EmptyNote text="No buyers in this window yet." />
              ) : (
                <>
                  <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--surface-raised)" }}>
                    <div style={{ width: `${data.audience.newVsReturning.newPct}%`, backgroundColor: "var(--brand-lavender)" }} />
                    <div style={{ width: `${data.audience.newVsReturning.returningPct}%`, backgroundColor: "rgba(159,103,254,0.18)" }} />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-theme-2">
                    <span><b className="text-theme">{data.audience.newVsReturning.newPct}%</b> new</span>
                    <span><b className="text-theme">{data.audience.newVsReturning.returningPct}%</b> returning</span>
                  </div>
                  {data.audience.newVsReturning.returningPct > 0 && (
                    <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {data.audience.newVsReturning.returningPct}% have bought from you before — your audience is starting to repeat.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl p-5 sm:p-6" style={card}>
              <h3 className="font-bold text-theme text-sm">Show-up rate</h3>
              <p className="text-theme-2 text-xs mt-0.5 mb-3">Checked in vs. tickets sold, past events</p>
              {!data.audience.showUpRate ? (
                <EmptyNote text="No past events in this scope yet." />
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-3xl text-theme" style={{ fontFamily: "var(--font-display)" }}>{data.audience.showUpRate.pct}%</span>
                    <ScanLine size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>of {data.audience.showUpRate.sampleSize.toLocaleString()} tickets scanned in at the door</p>
                  <div className="h-2 rounded-full overflow-hidden mt-3" style={{ backgroundColor: "var(--surface-raised)" }}>
                    <div className="h-full rounded-full" style={{ width: `${data.audience.showUpRate.pct}%`, backgroundColor: "var(--brand-lavender)" }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Events table ── */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <div className="p-5 sm:p-6" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <h3 className="font-bold text-theme">All events</h3>
          <p className="text-theme-2 text-xs mt-0.5">How each event is pacing right now</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth: 640 }}>
            <thead className="text-xs uppercase font-medium" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-muted)" }}>
              <tr>
                <th className="px-4 sm:px-6 py-3">Event</th>
                <th className="px-4 sm:px-6 py-3">Status</th>
                <th className="hidden sm:table-cell px-6 py-3">Sold</th>
                <th className="hidden md:table-cell px-6 py-3">Conversion</th>
                <th className="px-4 sm:px-6 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody style={{ color: "var(--text-secondary)" }}>
              {(data?.events || []).map(ev => (
                <tr key={ev.id} className="border-t hover:bg-[var(--surface-raised)] transition cursor-pointer" style={{ borderColor: "var(--card-border)" }} onClick={() => setScope(ev.id)}>
                  <td className="px-4 sm:px-6 py-3 max-w-[160px] sm:max-w-none">
                    <div className="font-medium text-theme truncate">{ev.title}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{new Date(ev.date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-3"><EventPaceChip status={ev.pace} size="xs" /></td>
                  <td className="hidden sm:table-cell px-6 py-3 whitespace-nowrap">{ev.sold.toLocaleString()}{ev.capacity > 0 && <span style={{ color: "var(--text-muted)" }}> / {ev.capacity.toLocaleString()}</span>}</td>
                  <td className="hidden md:table-cell px-6 py-3">{ev.conversionPct !== null ? `${ev.conversionPct}%` : "—"}</td>
                  <td className="px-4 sm:px-6 py-3 font-bold text-theme whitespace-nowrap">{fmtNaira(ev.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ icon, iconColor, iconBg, label, value, sub, newBadge }: {
  icon: ReactNode; iconColor: string; iconBg: string; label: string; value: string; sub?: string; newBadge?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4" style={card}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</div>
        <span className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
        {newBadge && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(159,103,254,0.14)", color: "var(--brand-indigo)" }}>New</span>}
      </div>
      <p className="font-bold text-xl sm:text-2xl truncate text-theme" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function PaceSummary({ events }: { events: EventSummary[] }) {
  const needsPush = events.filter(e => e.pace === "needs_push").length;
  if (events.length === 0) return <span className="text-sm text-theme-2">—</span>;
  if (needsPush === 0) {
    return <span className="font-bold text-sm text-theme">All events on track</span>;
  }
  return (
    <span className="font-bold text-sm text-theme">
      {needsPush} of {events.length} need{needsPush === 1 ? "s" : ""} a push
    </span>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>{text}</p>;
}
