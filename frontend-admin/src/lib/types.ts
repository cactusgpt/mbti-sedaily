// Backend admin API response shapes (verified from backend/admin/routes/*.py).

export interface LoginResponse {
  token: string;
  expires_at: string;
}

export type RuleState = "ENABLED" | "DISABLED" | "UNKNOWN";

export type CronPreset =
  | "5m"
  | "30m"
  | "1h"
  | "3h"
  | "6h"
  | "12h"
  | "daily-22kst"
  | "daily-04kst"
  | "custom";

export interface DriverRule {
  name: string;
  state: RuleState;
  schedule: string;
  preset: CronPreset;
}

export interface DriversResponse {
  rules: DriverRule[];
  feature_flags: Record<string, boolean>;
  thresholds: Record<string, number>;
}

export interface PromptListItem {
  id: string;
  active_version: number;
  updated_at: string;
}

export interface PromptHistoryEntry {
  version: number;
  created_at: string;
  actor: string;
}

export interface PromptDetail {
  id: string;
  active_content: string;
  active_version: number;
  history: PromptHistoryEntry[];
}

export interface CostEntry {
  input_tokens?: number;
  output_tokens?: number;
  cost_usd: number;
}

export interface CostResponse {
  by_lambda: Record<string, Record<string, CostEntry>>;
  total_7d_usd: number;
  note: string;
}

export interface AuditEntry {
  ts: string;
  action: string;
  detail?: Record<string, unknown> | null;
  actor?: string | null;
}

export interface AuditResponse {
  audits: AuditEntry[];
  count: number;
}
