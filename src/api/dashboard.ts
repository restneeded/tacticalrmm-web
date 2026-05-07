// Phase B — dashboard tile fetchers.
// Every tile reuses an EXISTING TRMM endpoint. See src/components/dashboard/.

import axios, { type AxiosRequestConfig } from "axios";

import type { AlertSeverity } from "@/types/alerts";
import { useAuthStore } from "@/stores/auth";

// In dev, the global axios request interceptor in boot/axios.js doesn't
// always re-attach after Vite HMR (the legacy app papers over this with
// per-instance retries and a 401-redirect). For these dashboard tiles we
// attach the Authorization header explicitly — surgical, no interceptor
// refactor required, and still uses the same axios instance + Vite proxy.
function authConfig(extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  const auth = useAuthStore();
  const token = auth.token as string | null;
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  };
}

// ── Pending alerts ────────────────────────────────────────────────────────────
// PATCH /alerts/ with {top: N} returns count + last N unresolved alerts.
// Confirmed shape (2026-05-07): { alerts_count, alerts: AlertRow[] }.
//
// AlertRow: minimal projection of fields the tile actually reads.
// The full Alert object has many more fields; only what we render is typed.
export interface AlertRow {
  id: number;
  alert_time: string | null;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  hostname?: string | null;
  agent?: string | null;
}
export interface TopAlertsResponse {
  alerts_count: number;
  alerts: AlertRow[];
}

export async function fetchTopAlerts(top = 5): Promise<TopAlertsResponse> {
  const { data } = await axios.patch<TopAlertsResponse>("/alerts/", { top }, authConfig());
  return data;
}

// ── Pending actions queued for agents (script runs, reboots, etc.) ────────────
// GET /logs/pendingactions/ → array of pending-action objects.
export interface PendingActionsResponse {
  pending_actions_count: number;
  // legacy returns a flat array; if hosted endpoint returns an object we still
  // surface a count without crashing.
  actions: Array<Record<string, unknown>>;
}

export async function fetchPendingActions(): Promise<PendingActionsResponse> {
  const { data } = await axios.get("/logs/pendingactions/", authConfig());
  if (Array.isArray(data)) {
    return { pending_actions_count: data.length, actions: data };
  }
  // unexpected shape — surface zero rather than throw, the tile shows empty state.
  return { pending_actions_count: 0, actions: [] };
}

// ── Recent agent history (online/offline, check status, script runs) ──────────
// GET /agents/history/ → array of history rows ordered most-recent first.
export interface AgentHistoryRow {
  id: number;
  time: string;
  type: string;
  command: string;
  username: string;
  results: string;
  script_results: string;
  agent: number;
  script: number | null;
  agent_name?: string;
}

export async function fetchAgentHistory(limit = 8): Promise<AgentHistoryRow[]> {
  const { data } = await axios.get<AgentHistoryRow[]>("/agents/history/", authConfig());
  if (!Array.isArray(data)) return [];
  return data.slice(0, limit);
}

// ── Clients & sites overview ──────────────────────────────────────────────────
// GET /clients/ → array of clients, each with embedded sites and agent_count.
export interface SiteSummary {
  id: number;
  name: string;
  agent_count: number;
  failing_checks: { error: boolean; warning: boolean };
  maintenance_mode: boolean;
}
export interface ClientSummary {
  id: number;
  name: string;
  agent_count: number;
  sites: SiteSummary[];
  maintenance_mode: boolean;
  failing_checks?: { error: boolean; warning: boolean };
}

export async function fetchClientsOverview(): Promise<ClientSummary[]> {
  const { data } = await axios.get<ClientSummary[]>("/clients/", authConfig());
  return Array.isArray(data) ? data : [];
}
