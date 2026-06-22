"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(eventDate: string): TimeLeft | null {
  const diff = new Date(eventDate).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function CountdownTimer({ eventDate }: { eventDate: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(eventDate));

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft(eventDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  const msUntilEvent = new Date(eventDate).getTime() - Date.now();
  if (msUntilEvent > SEVEN_DAYS_MS || msUntilEvent <= 0 || !timeLeft) return null;

  const isUrgent = timeLeft.days === 0;
  const accent   = isUrgent ? "#ef4444" : "#480082";
  const bgColor  = isUrgent ? "rgba(239,68,68,0.06)"  : "rgba(72,0,130,0.05)";
  const border   = isUrgent ? "rgba(239,68,68,0.2)"   : "rgba(72,0,130,0.12)";
  const boxBg    = isUrgent ? "rgba(239,68,68,0.08)"  : "rgba(72,0,130,0.08)";

  const units = [
    { value: timeLeft.days,    label: "Days"  },
    { value: timeLeft.hours,   label: "Hours" },
    { value: timeLeft.minutes, label: "Mins"  },
    { value: timeLeft.seconds, label: "Secs"  },
  ];

  return (
    <div
      className="mt-5 rounded-2xl p-5"
      style={{ backgroundColor: bgColor, border: `1px solid ${border}` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Timer size={15} style={{ color: accent }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
          {isUrgent ? "Last chance — event starts today!" : "Event starts in"}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {units.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <div
              className="w-full rounded-xl py-3 flex items-center justify-center tabular-nums"
              style={{ backgroundColor: boxBg }}
            >
              <span className="text-3xl font-bold" style={{ color: accent }}>
                {String(value).padStart(2, "0")}
              </span>
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
