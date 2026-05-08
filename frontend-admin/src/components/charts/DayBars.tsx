"use client";

// Daily vertical bars — for time-series activity counts (e.g. audit/day).
// Hovering surfaces the exact count via native title attribute.

export interface DayBar {
  label: string; // short axis label, e.g. "5/3"
  fullLabel?: string; // tooltip-friendly form, e.g. "2026-05-03"
  value: number;
}

interface DayBarsProps {
  data: DayBar[];
  height?: number; // px
  gradient?: string;
  emptyMessage?: string;
}

export function DayBars({
  data,
  height = 120,
  gradient = "from-fuchsia-500 to-pink-500",
  emptyMessage = "활동 없음",
}: DayBarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const totalValue = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0 || totalValue === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-600"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          // Even zero-value bars get a 2px stub so the axis remains visible.
          const pct = (d.value / max) * 100;
          const tooltip = `${d.fullLabel ?? d.label}: ${d.value}`;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end h-full group"
              title={tooltip}
            >
              <div
                className={`w-full rounded-t-md bg-gradient-to-t ${gradient} shadow-sm shadow-fuchsia-500/15 transition-all group-hover:brightness-110`}
                style={{
                  height: d.value === 0 ? 2 : `${Math.max(pct, 4)}%`,
                  opacity: d.value === 0 ? 0.3 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] font-mono text-slate-600 truncate"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
