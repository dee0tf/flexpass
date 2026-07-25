interface FunnelBarsProps {
  funnel: { opened: number; initiated: number; completed: number };
  emptyText?: string;
}

export default function FunnelBars({ funnel, emptyText = "No checkouts started in this window yet." }: FunnelBarsProps) {
  const { opened, initiated, completed } = funnel;
  if (opened === 0) return <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>{emptyText}</p>;

  const stages = [
    { label: "Opened checkout", value: opened, pct: 100 },
    { label: "Started payment", value: initiated, pct: opened > 0 ? Math.round((initiated / opened) * 100) : 0 },
    { label: "Completed purchase", value: completed, pct: opened > 0 ? Math.round((completed / opened) * 100) : 0 },
  ];

  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ backgroundColor: "var(--surface-raised)" }}>
              <div
                className="h-full rounded-lg flex items-center px-3 transition-all"
                style={{ width: `${Math.max(s.pct, 8)}%`, backgroundColor: i === 2 ? "var(--brand-indigo)" : "var(--brand-lavender)" }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap">{s.value.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-28 text-right shrink-0">
              <div className="text-xs font-semibold text-theme">{s.label}</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.pct}%</div>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="text-[10.5px] font-semibold pl-1 pt-1" style={{ color: "#b9740a" }}>
              {(stages[i].value - stages[i + 1].value).toLocaleString()} left before {i === 0 ? "starting payment" : "completing"}
            </div>
          )}
        </div>
      ))}
      <p className="text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>Tracked automatically from checkout — no setup needed.</p>
    </div>
  );
}
