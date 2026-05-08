"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminClient";
import type { PromptListItem } from "@/lib/types";

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listPrompts()
      .then((r) => setPrompts(r.prompts))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Prompts
        </h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!prompts) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Prompts
        </h1>
        <p className="text-sm text-slate-600">로드 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Prompts{" "}
          <span className="text-slate-600 font-normal text-lg">
            ({prompts.length})
          </span>
        </h1>
        <p className="text-xs text-slate-700">
          5-min TTL — 변경 후 production 반영
        </p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="glass-thead">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-800">
                ID
              </th>
              <th className="text-right px-4 py-3 font-semibold text-slate-800">
                Active Version
              </th>
              <th className="text-left px-4 py-3 font-semibold text-slate-800">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr
                key={p.id}
                className="border-b glass-divider last:border-0 glass-row-hover transition-colors"
              >
                <td className="px-4 py-2.5 font-mono text-sm">
                  <Link
                    href={`/prompts/edit?id=${encodeURIComponent(p.id)}`}
                    className="text-blue-700 hover:text-blue-900 hover:underline font-medium"
                  >
                    {p.id}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 font-medium">
                  v{p.active_version}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-700 tabular-nums">
                  {p.updated_at
                    ? new Date(p.updated_at).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
