"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { adminApi, AdminApiError } from "@/lib/adminClient";
import { useToast } from "@/components/Toast";
import type { PromptDetail } from "@/lib/types";

// useSearchParams 는 클라이언트 사이드 only — static export 시 Suspense boundary 필수.
export default function PromptEditPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Prompt</h1>
          <p className="text-sm text-zinc-500">로드 중...</p>
        </div>
      }
    >
      <PromptEditPage />
    </Suspense>
  );
}

function PromptEditPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id") ?? "";
  const slash = idParam.indexOf("/");
  const category = slash === -1 ? "" : idParam.slice(0, slash);
  const name = slash === -1 ? "" : idParam.slice(slash + 1);

  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!category || !name) return;
    let cancelled = false;
    adminApi
      .getPrompt(category, name)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setDraft(d.active_content);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [category, name]);

  if (!idParam) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Prompt</h1>
        <p className="text-sm text-red-600">id 쿼리 파라미터 없음</p>
        <Link href="/prompts" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Prompt: {idParam}</h1>
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/prompts" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Prompt: {idParam}</h1>
        <p className="text-sm text-zinc-500">로드 중...</p>
      </div>
    );
  }

  const dirty = draft !== detail.active_content;

  const save = async () => {
    if (saving || !dirty) return;
    if (!draft.trim()) {
      toast.show("내용이 비어있음 — 저장 거부", "error");
      return;
    }
    setSaving(true);
    try {
      const r = await adminApi.updatePrompt(category, name, draft);
      toast.show(`v${r.new_version} 저장 — 5분 안에 반영`, "success");
      // refresh detail to pick up new active_version + history
      const fresh = await adminApi.getPrompt(category, name);
      setDetail(fresh);
      setDraft(fresh.active_content);
    } catch (err) {
      const msg =
        err instanceof AdminApiError ? err.message : "저장 실패";
      toast.show(`저장 실패: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setDraft(detail.active_content);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Prompt: {detail.id}</h1>
        <Link href="/prompts" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
      </div>

      <div className="text-sm text-zinc-500">
        Active version:{" "}
        <span className="font-mono font-medium text-zinc-900">
          v{detail.active_version}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">Content</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full h-96 px-3 py-2 border border-zinc-300 rounded font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
          spellCheck={false}
        />
        <div className="flex gap-2 items-center text-xs text-zinc-500">
          <span>{draft.length} chars</span>
          {dirty && <span className="text-amber-600">●  unsaved</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "저장 중..." : `Save → v${detail.active_version + 1}`}
        </button>
        <button
          onClick={reset}
          disabled={!dirty || saving}
          className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setShowDiff(!showDiff)}
          disabled={!dirty}
          className="px-4 py-2 border border-zinc-300 rounded text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {showDiff ? "Hide" : "Show"} Diff
        </button>
      </div>

      {showDiff && dirty && (
        <SimpleDiff original={detail.active_content} modified={draft} />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          History ({detail.history.length})
        </h2>
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-zinc-700">
                  Version
                </th>
                <th className="text-left px-4 py-2 font-medium text-zinc-700">
                  Created
                </th>
                <th className="text-left px-4 py-2 font-medium text-zinc-700">
                  Actor
                </th>
                <th className="text-right px-4 py-2 font-medium text-zinc-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.history.map((h) => (
                <tr
                  key={h.version}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    v{h.version}
                    {h.version === detail.active_version && (
                      <span className="ml-1 text-emerald-600">●</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {h.created_at
                      ? new Date(h.created_at).toLocaleString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })
                      : "-"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{h.actor}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={async () => {
                        // load that version's content via getPrompt — but API doesn't
                        // expose individual versions in detail; the history rows are
                        // metadata-only. To restore, admin would need a v#N read API.
                        // For now: editor surfaces only the active version. Inform.
                        toast.show(
                          "v#N 읽기 API 미구현 — 백업 보관 후 직접 paste 필요",
                          "info"
                        );
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-900"
                    >
                      load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SimpleDiff({
  original,
  modified,
}: {
  original: string;
  modified: string;
}) {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const maxLen = Math.max(origLines.length, modLines.length);
  return (
    <div className="bg-zinc-900 text-zinc-100 rounded p-3 overflow-auto max-h-80 font-mono text-xs leading-relaxed">
      {Array.from({ length: maxLen }).map((_, i) => {
        const o = origLines[i];
        const m = modLines[i];
        if (o === m) {
          return (
            <div key={i} className="text-zinc-500">
              {"  "}
              {o ?? ""}
            </div>
          );
        }
        return (
          <div key={i}>
            {o !== undefined && (
              <div className="bg-red-950/60 text-red-200">- {o}</div>
            )}
            {m !== undefined && (
              <div className="bg-emerald-950/60 text-emerald-200">+ {m}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
