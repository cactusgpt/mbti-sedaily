"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminClient";
import type { CostResponse } from "@/lib/types";

export default function CostPage() {
  const [data, setData] = useState<CostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getCost()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Cost (7-day estimate)</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Cost (7-day estimate)</h1>
        <p className="text-sm text-zinc-500">로드 중...</p>
      </div>
    );
  }

  // Build flat rows: (lambda, model, input_tokens, output_tokens, cost_usd)
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

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Cost (7-day estimate)</h1>
        <div className="text-3xl font-bold text-blue-600">
          ${data.total_7d_usd.toFixed(2)}
        </div>
      </div>

      <p className="text-xs text-zinc-500 leading-snug">{data.note}</p>

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-zinc-700">
                Lambda
              </th>
              <th className="text-left px-4 py-2 font-medium text-zinc-700">
                Model
              </th>
              <th className="text-right px-4 py-2 font-medium text-zinc-700">
                Input Tokens
              </th>
              <th className="text-right px-4 py-2 font-medium text-zinc-700">
                Output Tokens
              </th>
              <th className="text-right px-4 py-2 font-medium text-zinc-700">
                Cost (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.lambda}/${r.model}`}
                className="border-b border-zinc-100 last:border-0"
              >
                <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                  {r.lambda}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                  {r.model}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                  {r.input_tokens != null
                    ? r.input_tokens.toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                  {r.output_tokens != null
                    ? r.output_tokens.toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-zinc-900">
                  ${r.cost_usd.toFixed(4)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-zinc-500"
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
