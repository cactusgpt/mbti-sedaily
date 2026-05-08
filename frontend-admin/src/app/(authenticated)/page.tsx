"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminClient";
import { Donut, DayBars, type DayBar } from "@/components/charts";
import type {
  AuditEntry,
  CostResponse,
  DriversResponse,
} from "@/lib/types";

const ACTIVITY_DAYS = 14;

export default function DashboardPage() {
  const [drivers, setDrivers] = useState<DriversResponse | null>(null);
  const [cost, setCost] = useState<CostResponse | null>(null);
  const [audits, setAudits] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Snapshot "now" once at mount — avoids react-hooks/purity flag on Date.now()
  // and keeps the activity axis stable across re-renders.
  const [nowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.getDrivers(),
      adminApi.getCost(),
      adminApi.getAudit(200),
    ]).then(([d, c, a]) => {
      if (cancelled) return;
      if (d.status === "fulfilled") setDrivers(d.value);
      if (c.status === "fulfilled") setCost(c.value);
      if (a.status === "fulfilled") setAudits(a.value.audits);
      const failed = [d, c, a].filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const reasons = failed
          .map((r) => (r as PromiseRejectedResult).reason?.message)
          .join(", ");
        setError(reasons || "일부 위젯 로드 실패");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledFlags = drivers
    ? Object.values(drivers.feature_flags).filter(Boolean).length
    : null;
  const totalFlags = drivers ? Object.keys(drivers.feature_flags).length : null;
  const activeRules = drivers
    ? drivers.rules.filter((r) => r.state === "ENABLED").length
    : null;
  const totalRules = drivers ? drivers.rules.length : null;

  // 14-day audit activity, KST. Bucket each audit ts into its KST date string,
  // then realign to a continuous date axis ending today so empty days show.
  const dayBars: DayBar[] = useMemo(() => {
    if (!audits) return [];
    const counts = new Map<string, number>();
    for (const a of audits) {
      const d = new Date(a.ts);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const key = kst.toISOString().slice(0, 10); // YYYY-MM-DD
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const out: DayBar[] = [];
    const todayKst = new Date(nowMs + 9 * 60 * 60 * 1000);
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
      const day = new Date(todayKst);
      day.setUTCDate(todayKst.getUTCDate() - i);
      const key = day.toISOString().slice(0, 10);
      const month = day.getUTCMonth() + 1;
      const date = day.getUTCDate();
      out.push({
        label: `${month}/${date}`,
        fullLabel: key,
        value: counts.get(key) ?? 0,
      });
    }
    return out;
  }, [audits, nowMs]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Dashboard
      </h1>

      {error && (
        <div className="glass-panel rounded-xl text-amber-900 text-sm p-4 ring-1 ring-amber-300/40">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Widget
          label="7-Day Cost (estimate)"
          value={cost ? `$${cost.total_7d_usd.toFixed(2)}` : "..."}
          sub={cost ? cost.note : undefined}
          accent="from-blue-500/15 to-indigo-500/15"
        />
        <Widget
          label="Active EventBridge Rules"
          value={
            activeRules !== null && totalRules !== null
              ? `${activeRules} / ${totalRules}`
              : "..."
          }
          accent="from-emerald-500/15 to-teal-500/15"
        />
        <Widget
          label="Feature Flags Enabled"
          value={
            enabledFlags !== null && totalFlags !== null
              ? `${enabledFlags} / ${totalFlags}`
              : "..."
          }
          accent="from-fuchsia-500/15 to-pink-500/15"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Rules State">
          {drivers === null ? (
            <ChartLoading />
          ) : (
            <Donut
              segments={[
                {
                  label: "ENABLED",
                  value: drivers.rules.filter((r) => r.state === "ENABLED")
                    .length,
                  color: "rgb(16, 185, 129)", // emerald-500
                },
                {
                  label: "DISABLED",
                  value: drivers.rules.filter((r) => r.state !== "ENABLED")
                    .length,
                  color: "rgb(148, 163, 184)", // slate-400
                },
              ]}
              centerLabel={
                totalRules !== null ? `${activeRules}/${totalRules}` : ""
              }
              centerSubLabel="active"
            />
          )}
        </ChartCard>

        <ChartCard title="Feature Flags">
          {drivers === null ? (
            <ChartLoading />
          ) : (
            <Donut
              segments={[
                {
                  label: "ON",
                  value: enabledFlags ?? 0,
                  color: "rgb(217, 70, 239)", // fuchsia-500
                },
                {
                  label: "OFF",
                  value: (totalFlags ?? 0) - (enabledFlags ?? 0),
                  color: "rgb(148, 163, 184)", // slate-400
                },
              ]}
              centerLabel={
                totalFlags !== null ? `${enabledFlags}/${totalFlags}` : ""
              }
              centerSubLabel="on"
            />
          )}
        </ChartCard>

        <ChartCard title={`Activity (last ${ACTIVITY_DAYS} days)`}>
          {audits === null ? (
            <ChartLoading />
          ) : (
            <DayBars data={dayBars} height={140} />
          )}
        </ChartCard>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-semibold mb-3 text-slate-900">최근 변경 (5건)</h2>
        {audits === null ? (
          <p className="text-sm text-slate-600">...</p>
        ) : audits.length === 0 ? (
          <p className="text-sm text-slate-600">audit 없음</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audits.slice(0, 5).map((a) => (
              <li
                key={a.ts}
                className="flex justify-between items-baseline border-b glass-divider pb-2 last:border-0 last:pb-0"
              >
                <span className="font-mono text-slate-800">{a.action}</span>
                <span className="text-xs text-slate-600 tabular-nums">
                  {new Date(a.ts).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Widget({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
      <div
        className={`absolute inset-0 -z-0 bg-gradient-to-br ${accent} pointer-events-none`}
      />
      <div className="relative">
        <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-3xl font-bold mt-2 text-slate-900 tabular-nums">
          {value}
        </div>
        {sub && (
          <div className="text-xs text-slate-600 mt-2 leading-snug">{sub}</div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="h-32 flex items-center justify-center text-sm text-slate-600">
      ...
    </div>
  );
}
