"use client";

// Horizontal bar chart — div + CSS width %, no SVG needed.
// Designed to sit inside a glass-panel; bars use a gradient that pops on the
// translucent background.

export interface HBarItem {
  label: string;
  value: number;
  /** Optional secondary text under the label (e.g. model id). */
  sub?: string;
}

interface HBarProps {
  data: HBarItem[];
  maxItems?: number;
  /** Format the numeric value shown on the right. */
  format?: (v: number) => string;
  /** Tailwind gradient classes for the filled bar. */
  gradient?: string;
}

export function HBar({
  data,
  maxItems = 10,
  format = (v) => v.toLocaleString(),
  gradient = "from-blue-500 to-indigo-500",
}: HBarProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  const max = sorted.length > 0 ? sorted[0].value : 1;

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-600 py-4 text-center">데이터 없음</p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {sorted.map((item, i) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <li key={`${item.label}-${i}`} className="text-xs">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span
                className="font-mono text-slate-800 truncate"
                title={item.label}
              >
                {item.label}
              </span>
              <span className="tabular-nums text-slate-900 font-semibold shrink-0">
                {format(item.value)}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-300/30 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient} shadow-sm transition-[width] duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sub && (
              <div className="mt-0.5 text-[10px] font-mono text-slate-600 truncate">
                {item.sub}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
