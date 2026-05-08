"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminClient";
import { Donut, HBar, type DonutSegment, type HBarItem } from "@/components/charts";
import type { CostResponse } from "@/lib/types";

// Pretty colors aligned with the dashboard's accent palette.
const MODEL_COLORS = [
  "rgb(99, 102, 241)", // indigo-500
  "rgb(217, 70, 239)", // fuchsia-500
  "rgb(16, 185, 129)", // emerald-500
  "rgb(245, 158, 11)", // amber-500
  "rgb(56, 189, 248)", // sky-400
  "rgb(244, 114, 182)", // pink-400
  "rgb(148, 163, 184)", // slate-400 — fallback
];

// `sedaily-mbti-` 접두어를 줄여서 라벨에 더 많은 정보가 들어가도록.
function shortLambda(name: string): string {
  return name.replace(/^sedaily-mbti-/, "");
}

function shortModel(model: string): string {
  // "us.anthropic.claude-opus-4-6-v1:0" → "claude-opus-4-6"
  return model
    .replace(/^us\./, "")
    .replace(/^anthropic\./, "")
    .replace(/^amazon\./, "")
    .replace(/-v\d+:\d+$/, "");
}

export default function CostPage() {
  const [data, setData] = useState<CostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getCost()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  // Flat per (lambda, model) rows + aggregate views.
  const flat = useMemo(() => {
    if (!data) return null;
    const rows: {
      lambda: string;
      model: string;
      input_tokens?: number;
      output_tokens?: number;
      cost_usd: number;
    }[] = [];
    for (const [lambda, byModel] of Object.entries(data.by_lambda)) {
      for (const [model, entry] of Object.entries(byModel)) {
        rows.push({
          lambda,
          model,
          input_tokens: entry.input_tokens,
          output_tokens: entry.output_tokens,
          cost_usd: entry.cost_usd,
        });
      }
    }
    rows.sort((a, b) => b.cost_usd - a.cost_usd);

    // Lambda → total cost
    const byLambda = new Map<string, number>();
    for (const r of rows) {
      byLambda.set(r.lambda, (byLambda.get(r.lambda) ?? 0) + r.cost_usd);
    }
    const lambdaBars: HBarItem[] = Array.from(byLambda.entries()).map(
      ([lambda, cost]) => ({ label: shortLambda(lambda), value: cost })
    );

    // Model → total cost (cost share donut)
    const byModel = new Map<string, number>();
    for (const r of rows) {
      byModel.set(r.model, (byModel.get(r.model) ?? 0) + r.cost_usd);
    }
    const modelSegments: DonutSegment[] = Array.from(byModel.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([model, cost], i) => ({
        label: shortModel(model),
        value: Math.round(cost * 10000) / 10000, // 4dp for legend tidiness
        color: MODEL_COLORS[i % MODEL_COLORS.length],
      }));

    // Lambda → total tokens (input vs output, top 8)
    type TokenRow = { lambda: string; input: number; output: number };
    const tokenMap = new Map<string, TokenRow>();
    for (const r of rows) {
      const cur = tokenMap.get(r.lambda) ?? {
        lambda: r.lambda,
        input: 0,
        output: 0,
      };
      cur.input += r.input_tokens ?? 0;
      cur.output += r.output_tokens ?? 0;
      tokenMap.set(r.lambda, cur);
    }
    const tokenRows = Array.from(tokenMap.values())
      .sort((a, b) => b.input + b.output - (a.input + a.output))
      .slice(0, 8);

    return { rows, lambdaBars, modelSegments, tokenRows };
  }, [data]);

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Cost (7-day estimate)
        </h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data || !flat) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Cost (7-day estimate)
        </h1>
        <p className="text-sm text-slate-600">로드 중...</p>
      </div>
    );
  }

  const { rows, lambdaBars, modelSegments, tokenRows } = flat;
  const tokenMax = Math.max(
    ...tokenRows.map((r) => Math.max(r.input, r.output)),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Cost{" "}
          <span className="text-slate-600 font-normal text-lg">
            (7-day estimate)
          </span>
        </h1>
        <div className="text-3xl font-bold text-blue-700 tabular-nums">
          ${data.total_7d_usd.toFixed(2)}
        </div>
      </div>

      <p className="text-xs text-slate-700 leading-snug max-w-3xl">{data.note}</p>

      {/* Charts row 1: lambda cost bars + model cost donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Cost by Lambda (top 8)
          </h3>
          <HBar
            data={lambdaBars}
            maxItems={8}
            format={(v) => `$${v.toFixed(4)}`}
            gradient="from-blue-500 to-indigo-500"
          />
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
            Cost by Model
          </h3>
          {modelSegments.length === 0 ? (
            <p className="text-sm text-slate-600">데이터 없음</p>
          ) : (
            <Donut
              segments={modelSegments.map((s) => ({
                ...s,
                // Legend shows $; donut value still drives the arc proportion.
                label: s.label,
              }))}
              centerLabel={`$${data.total_7d_usd.toFixed(2)}`}
              centerSubLabel="total"
            />
          )}
        </div>
      </div>

      {/* Charts row 2: input vs output tokens grouped bar (raw HTML) */}
      <div className="glass-panel rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
          Input vs Output Tokens (top 8 by total)
        </h3>
        {tokenRows.length === 0 ? (
          <p className="text-sm text-slate-600">데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {tokenRows.map((r) => {
              const inPct = (r.input / tokenMax) * 100;
              const outPct = (r.output / tokenMax) * 100;
              return (
                <div key={r.lambda} className="text-xs">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono text-slate-800 truncate">
                      {shortLambda(r.lambda)}
                    </span>
                    <span className="tabular-nums text-slate-700">
                      <span className="text-sky-700 font-semibold">
                        in {r.input.toLocaleString()}
                      </span>
                      <span className="text-slate-400 mx-1.5">/</span>
                      <span className="text-fuchsia-700 font-semibold">
                        out {r.output.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-slate-300/30 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full"
                        style={{ width: `${inPct}%` }}
                        title={`input: ${r.input.toLocaleString()}`}
                      />
                    </div>
                    <div className="h-2 rounded-full bg-slate-300/30 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-500 rounded-full"
                        style={{ width: `${outPct}%` }}
                        title={`output: ${r.output.toLocaleString()}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 text-[10px] pt-1 text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500" />
                input
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-500" />
                output
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Detail table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="glass-thead">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-800">
                Lambda
              </th>
              <th className="text-left px-4 py-3 font-semibold text-slate-800">
                Model
              </th>
              <th className="text-right px-4 py-3 font-semibold text-slate-800">
                Input Tokens
              </th>
              <th className="text-right px-4 py-3 font-semibold text-slate-800">
                Output Tokens
              </th>
              <th className="text-right px-4 py-3 font-semibold text-slate-800">
                Cost (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.lambda}/${r.model}`}
                className="border-b glass-divider last:border-0 glass-row-hover transition-colors"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-slate-800">
                  {r.lambda}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-800">
                  {r.model}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                  {r.input_tokens != null
                    ? r.input_tokens.toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                  {r.output_tokens != null
                    ? r.output_tokens.toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                  ${r.cost_usd.toFixed(4)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-slate-600"
                >
                  데이터 없음 (지난 7일간 token 사용 0)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
