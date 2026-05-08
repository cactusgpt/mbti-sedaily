"use client";

// SVG donut chart — pure presentation, no deps.
// Uses stroke-dasharray on stacked circles (cross-browser, no path math).

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // CSS color e.g. "rgb(59, 130, 246)"
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function Donut({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerSubLabel,
}: DonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  // Pre-compute each segment's cumulative-start fraction so the render path is
  // pure (no mutated accumulator inside .map). O(n²) but n is tiny.
  const sumBefore = (i: number) =>
    segments.slice(0, i).reduce((s, x) => s + x.value, 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth={thickness}
          />
          {/* segments — rotated -90deg so 0° is top (12 o'clock) */}
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map((seg, i) => {
              if (total === 0 || seg.value === 0) return null;
              const fraction = seg.value / total;
              const dash = fraction * circ;
              const offset = -(sumBefore(i) / total) * circ;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </g>
        </svg>
        {(centerLabel || centerSubLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {centerLabel && (
              <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                {centerLabel}
              </div>
            )}
            {centerSubLabel && (
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mt-1 font-semibold">
                {centerSubLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* legend */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: seg.color }}
              aria-hidden
            />
            <span className="text-slate-700 font-medium">{seg.label}</span>
            <span className="text-slate-600 tabular-nums">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
