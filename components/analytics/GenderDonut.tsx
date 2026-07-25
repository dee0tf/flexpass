"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface GenderDonutProps {
  female: number;
  male: number;
  other: number;
  total: number;
}

export default function GenderDonut({ female, male, other, total }: GenderDonutProps) {
  const data = [
    { name: "Female", value: female, color: "var(--chart-cat-5)" },
    { name: "Male", value: male, color: "var(--chart-cat-1)" },
    { name: "Other", value: other, color: "var(--surface-raised)" },
  ].filter(d => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[112px] text-xs" style={{ color: "var(--text-muted)" }}>
        No buyer data yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-[112px] h-[112px] shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={54}
              paddingAngle={2}
              stroke="var(--card-bg)"
              strokeWidth={2}
            >
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10, border: "1px solid var(--card-border)",
                backgroundColor: "var(--card-bg)", fontSize: 12,
              }}
              formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0}%`, name ?? ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            {total}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs min-w-0">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            {d.name} <b style={{ color: "var(--text-primary)" }}>{Math.round(d.value)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
