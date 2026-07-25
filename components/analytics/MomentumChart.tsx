"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MomentumPoint { date: string; value: number }

interface MomentumChartProps {
  data: MomentumPoint[];
  /** Tooltip value formatter — defaults to "N tickets". */
  formatValue?: (value: number) => string;
  /** Y-axis tick formatter — defaults to the raw number. */
  formatAxis?: (value: number) => string;
}

export default function MomentumChart({ data, formatValue, formatAxis }: MomentumChartProps) {
  const fmtValue = formatValue ?? ((v: number) => `${v} ticket${v === 1 ? "" : "s"}`);
  const fmtAxis = formatAxis ?? ((v: number) => String(v));

  const formatted = data.map(d => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  // Thin the x-axis so labels never collide, regardless of range length.
  const tickInterval = Math.max(0, Math.ceil(formatted.length / 6) - 1);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-lavender)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand-lavender)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={40}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={fmtAxis}
          />
          <Tooltip
            cursor={{ stroke: "var(--brand-lavender)", strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: 12, border: "1px solid var(--card-border)",
              backgroundColor: "var(--card-bg)", fontSize: 12,
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.15)",
            }}
            labelStyle={{ color: "var(--text-secondary)", fontWeight: 600, marginBottom: 2 }}
            itemStyle={{ color: "var(--text-primary)" }}
            formatter={(value: number | undefined) => [fmtValue(value ?? 0), ""]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--brand-lavender)"
            strokeWidth={2}
            fill="url(#momentumFill)"
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card-bg)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
