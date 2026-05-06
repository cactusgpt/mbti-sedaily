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
        <h1 className="text-2xl font-bold">Prompts</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!prompts) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Prompts</h1>
        <p className="text-sm text-zinc-500">로드 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Prompts ({prompts.length})</h1>
        <p className="text-xs text-zinc-500">5-min TTL — 변경 후 production 반영</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-zinc-700">
                ID
              </th>
              <th className="text-right px-4 py-2 font-medium text-zinc-700">
                Active Version
              </th>
              <th className="text-left px-4 py-2 font-medium text-zinc-700">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr
                key={p.id}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
              >
                <td className="px-4 py-2 font-mono text-sm">
                  <Link
                    href={`/prompts/edit?id=${encodeURIComponent(p.id)}`}
                    className="text-blue-600 hover:underline"
                  >
                    {p.id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  v{p.active_version}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
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
