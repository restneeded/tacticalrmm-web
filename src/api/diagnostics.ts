// Phase R — Diagnostics aggregator API.
// Backend: GET /core/health/ (Phase R, IsAuthenticated).
// Also wraps a few existing per-agent endpoints used by the agent
// Diagnostics tab.

import axios, { type AxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/auth";

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

export interface DiagnosticsHealth {
  generated_at: string;
  core: {
    trmm_version: string;
    latest_trmm_ver: string;
    latest_agent_ver: string;
    cert: { days_until_expiry: number | null; expired: boolean | null; error: string | null };
  };
  services: Record<string, boolean | null>;
  probes: { redis_ping: boolean; nats_std: boolean; nats_ws: boolean; mesh: boolean };
  celery: { queue_len: number; health: string };
  db: {
    agents: number;
    clients: number;
    sites: number;
    alerts_unresolved: number;
    pending_actions: number;
    audit_logs_24h: number;
  };
  fleet_last_seen: {
    lt_1h: number;
    lt_24h: number;
    lt_7d: number;
    lt_30d: number;
    older: number;
    never: number;
  };
  debug_logs_24h: { info: number; warning: number; error: number; critical: number };
}

export async function fetchHealth(): Promise<DiagnosticsHealth> {
  const r = await axios.get<DiagnosticsHealth>("/core/health/", authConfig());
  return r.data;
}

// --- Recent debug log fetcher (last 1000 entries server-side cap) ---
export interface DebugLogRow {
  id: number;
  entry_time: string;
  log_level: string;
  log_type: string;
  message: string | null;
  agent: string | null;
}

export async function fetchDebugLogs(
  filter: { logLevelFilter?: string; logTypeFilter?: string; agentFilter?: string } = {},
): Promise<DebugLogRow[]> {
  const r = await axios.patch<DebugLogRow[]>("/logs/debug/", filter, authConfig());
  return r.data;
}

// --- Per-agent diagnostic actions ---
export async function recoverAgent(
  agentId: string,
  mode: "tacagent" | "mesh",
): Promise<unknown> {
  const r = await axios.post(
    `/agents/${encodeURIComponent(agentId)}/recover/`,
    { mode },
    authConfig(),
  );
  return r.data;
}

export async function pingAgent(agentId: string): Promise<{ name: string; status: string }> {
  const r = await axios.get<{ name: string; status: string }>(
    `/agents/${encodeURIComponent(agentId)}/ping/`,
    authConfig(),
  );
  return r.data;
}

export interface AgentProcess {
  name: string;
  pid: number;
  membytes: number;
  username: string;
  id: string;
}

export async function fetchAgentProcesses(agentId: string): Promise<AgentProcess[]> {
  const r = await axios.get<AgentProcess[]>(
    `/agents/${encodeURIComponent(agentId)}/processes/`,
    authConfig(),
  );
  return r.data;
}

export async function killAgentProcess(agentId: string, pid: number): Promise<void> {
  await axios.delete(
    `/agents/${encodeURIComponent(agentId)}/processes/${pid}/`,
    authConfig(),
  );
}

export interface EventLogEntry {
  source: string;
  eventType: string;
  eventID: number;
  message: string;
  time: string;
}

export async function fetchAgentEventLog(
  agentId: string,
  logtype: "Application" | "System" | "Security",
  days: number,
): Promise<EventLogEntry[]> {
  const r = await axios.get<EventLogEntry[]>(
    `/agents/${encodeURIComponent(agentId)}/eventlog/${logtype}/${days}/`,
    authConfig(),
  );
  return r.data;
}
