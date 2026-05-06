"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminClient";
import type {
  AuditEntry,
  CostResponse,
  DriversResponse,
} from "@/lib/types";

export default function DashboardPage() {
  const [drivers, setDrivers] = useState<DriversResponse | null>(null);
  const [cost, setCost] = useState<CostResponse | null>(null);
  const [audits, setAudits] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminApi.getDrivers(),
      adminApi.getCost(),
      adminApi.getAudit(5),
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Widget
          label="7-Day Cost (estimate)"
          value={cost ? `$${cost.total_7d_usd.toFixed(2)}` : "..."}
          sub={cost ? cost.note : undefined}
        />
        <Widget
          label="Active EventBridge Rules"
          value={
            activeRules !== null && totalRules !== null
              ? `${activeRules} / ${totalRules}`
              : "..."
          }
        />
        <Widget
          label="Feature Flags Enabled"
          value={
            enabledFlags !== null && totalFlags !== null
              ? `${enabledFlags} / ${totalFlags}`
              : "..."
          }
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
        <h2 className="font-semibold mb-3 text-zinc-900">최근 변경 (5건)</h2>
        {audits === null ? (
          <p className="text-sm text-zinc-500">...</p>
        ) : audits.length === 0 ? (
          <p className="text-sm text-zinc-500">audit 없음</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {audits.map((a) => (
              <li
                key={a.ts}
                className="flex justify-between items-baseline border-b border-zinc-100 pb-1.5 last:border-0"
              >
                <span className="font-mono text-zinc-700">{a.action}</span>
                <span className="text-xs text-zinc-500">
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
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-zinc-900">{value}</div>
      {sub && (
        <div className="text-xs text-zinc-400 mt-2 leading-snug">{sub}</div>
      )}
    </div>
  );
}
