// Single admin API wrapper — 9 backend endpoints + auth + 401 redirect.
// All endpoints documented in /backend/admin/routes/*.py (Admin-1 + 2a + 2d + 3).

import { getToken, clearAuth } from "./auth";
import type {
  LoginResponse,
  DriversResponse,
  PromptListItem,
  PromptDetail,
  CostResponse,
  AuditResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL;
if (!BASE) {
  // 빌드 시점이면 fail-loud — runtime fetch 가 undefined URL 로 가기 전에 잡음.
  // .env.local 에 NEXT_PUBLIC_ADMIN_API_BASE_URL 설정 필요.
  console.error("NEXT_PUBLIC_ADMIN_API_BASE_URL is not set");
}

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AdminApiError";
  }
}

interface RequestOpts extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOpts = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth) {
    const token = getToken();
    if (!token) {
      // AuthGuard 가 정상이면 여기 안 옴. 안전망.
      throw new AdminApiError(401, "not authenticated");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new AdminApiError(0, `network error: ${(err as Error).message}`);
  }

  // 401 토큰 만료 — clearAuth + /login redirect (브라우저 환경 한정).
  if (response.status === 401 && !options.skipAuth) {
    clearAuth();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new AdminApiError(401, "session expired");
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch {
      /* response body wasn't JSON; keep status string */
    }
    throw new AdminApiError(response.status, message);
  }

  // 204 No Content 같은 경우 body 없음.
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export const adminApi = {
  // Auth
  login: (password: string) =>
    request<LoginResponse>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      skipAuth: true,
    }),
  changePassword: (oldPwd: string, newPwd: string) =>
    request<{ ok: boolean }>("/admin/password-change", {
      method: "POST",
      body: JSON.stringify({ old: oldPwd, new: newPwd }),
    }),

  // Drivers
  getDrivers: () => request<DriversResponse>("/admin/drivers"),
  updateRule: (
    id: string,
    body: { action: "enable" | "disable" | "set-cron"; cron_preset?: string }
  ) =>
    request<{ ok: boolean; rule: unknown }>(`/admin/drivers/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  toggleFeatureFlag: (name: string, action: "enable" | "disable") =>
    request<{ flag: string; enabled: boolean; updated_at: string }>(
      `/admin/drivers/feature-flag/${encodeURIComponent(name)}`,
      { method: "POST", body: JSON.stringify({ action }) }
    ),
  updateThreshold: (name: string, value: number) =>
    request<{ threshold: string; value: number; updated_at: string }>(
      `/admin/drivers/threshold/${encodeURIComponent(name)}`,
      { method: "POST", body: JSON.stringify({ value }) }
    ),

  // Prompts
  listPrompts: () =>
    request<{ prompts: PromptListItem[] }>("/admin/prompts"),
  getPrompt: (category: string, name: string) =>
    request<PromptDetail>(
      `/admin/prompts/${encodeURIComponent(category)}/${encodeURIComponent(name)}`
    ),
  updatePrompt: (category: string, name: string, content: string) =>
    request<{ ok: boolean; new_version: number }>(
      `/admin/prompts/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
      { method: "POST", body: JSON.stringify({ content }) }
    ),

  // Cost & Audit
  getCost: () => request<CostResponse>("/admin/cost"),
  getAudit: (limit = 50) =>
    request<AuditResponse>(`/admin/audit?limit=${limit}`),
};
