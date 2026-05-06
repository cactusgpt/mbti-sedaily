"use client";

import { useState } from "react";
import { adminApi, AdminApiError } from "@/lib/adminClient";
import { useToast } from "@/components/Toast";

const MIN_LEN = 12;

export default function SettingsPage() {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const validate = (): string | null => {
    if (!oldPwd || !newPwd || !confirmPwd) return "모든 필드 입력 필요";
    if (newPwd.length < MIN_LEN) return `새 비밀번호 ≥ ${MIN_LEN}자`;
    if (newPwd === oldPwd) return "새 비밀번호가 기존과 같음";
    if (newPwd !== confirmPwd) return "새 비밀번호 확인 불일치";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const v = validate();
    if (v) {
      toast.show(v, "error");
      return;
    }
    setSaving(true);
    try {
      await adminApi.changePassword(oldPwd, newPwd);
      toast.show("비밀번호 변경 완료 — 1Password 등 외부 저장소도 갱신하세요", "success");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : "변경 실패";
      toast.show(`변경 실패: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">비밀번호 변경</h2>
        <p className="text-xs text-zinc-500">
          변경 후 SSM /sedaily-mbti/admin/password-hash 에 새 argon2id hash 저장. 기존 JWT 는 만료까지 유효.
        </p>

        <Field
          label="현재 비밀번호"
          value={oldPwd}
          setValue={setOldPwd}
          autoComplete="current-password"
        />
        <Field
          label={`새 비밀번호 (≥ ${MIN_LEN}자)`}
          value={newPwd}
          setValue={setNewPwd}
          autoComplete="new-password"
        />
        <Field
          label="새 비밀번호 확인"
          value={confirmPwd}
          setValue={setConfirmPwd}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "변경 중..." : "변경"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  autoComplete,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={autoComplete}
        className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
