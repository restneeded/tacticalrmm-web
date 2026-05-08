// Phase C — Devices API.
// All endpoints verified against tacticalrmm/agents/views.py + urls.py:
//   GET  /agents/?detail=true              → list (no server pagination)
//   PUT  /agents/<agent_id>/                → partial edit (description, monitoring_type, …)
//   POST /agents/<agent_id>/reboot/         → single reboot (used to "bulk-iterate" reboots)
//   POST /agents/actions/bulk/              → native bulk: command | script | patch
//
// Same HMR-safe Authorization-header pattern as src/api/dashboard.ts (Phase B).

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

// ── Types — projection of AgentTableSerializer fields ────────────────────────
// Source: tacticalrmm/api/tacticalrmm/agents/serializers.py::AgentTableSerializer
export type AgentStatus = "online" | "offline" | "overdue";
export type AgentMonType = "server" | "workstation";
export type AgentPlat = "windows" | "linux" | "darwin";

export interface AgentChecks {
  total: number;
  passing: number;
  failing: number;
  warning: number;
  info: number;
  has_failing_checks: boolean;
}

export interface AgentRow {
  agent_id: string;
  hostname: string;
  client_name: string;
  site_name: string;
  monitoring_type: AgentMonType;
  description: string | null;
  needs_reboot: boolean;
  pending_actions_count: number;
  status: AgentStatus;
  last_seen: string | null;
  boot_time: number | null;
  checks: AgentChecks;
  maintenance_mode: boolean;
  logged_username: string;
  italic: boolean;
  has_patches_pending: boolean;
  version: string;
  operating_system: string;
  public_ip: string;
  local_ips: string;
  plat: AgentPlat;
  goarch: string;
  cpu_model?: string[] | string;
  make_model?: string;
  // legacy table also reads alert_template + serial_number; not used by Phase C UI
  // but kept loose so the row object can be passed through unchanged.
  [extra: string]: unknown;
}

// ── List ─────────────────────────────────────────────────────────────────────
export interface ListAgentsParams {
  // Pass-through to GET /agents/. monitoring_type/site/client narrow on the server,
  // everything else (search, OS family, etc.) is filtered client-side.
  monitoring_type?: AgentMonType;
  client?: number | string;
  site?: number | string;
}

export async function fetchAgents(params: ListAgentsParams = {}): Promise<AgentRow[]> {
  const cfg = authConfig({ params: { detail: "true", ...params } });
  const { data } = await axios.get<AgentRow[]>("/agents/", cfg);
  return Array.isArray(data) ? data : [];
}

// ── Inline edit ──────────────────────────────────────────────────────────────
// PUT body fields verified in GetUpdateDeleteAgent.InputSerializer.
export interface AgentPatch {
  description?: string;
  monitoring_type?: AgentMonType;
  maintenance_mode?: boolean;
}

export async function patchAgent(agent_id: string, patch: AgentPatch): Promise<void> {
  await axios.put(`/agents/${agent_id}/`, patch, authConfig());
}

// ── Single reboot (used by client-side bulk-reboot iterator) ────────────────
export async function rebootAgent(agent_id: string): Promise<void> {
  await axios.post(`/agents/${agent_id}/reboot/`, { type: "reboot" }, authConfig());
}

// ── Native bulk endpoint ─────────────────────────────────────────────────────
// Shape verified in views.bulk(). Caller fills the mode-specific fields.
export type BulkMode = "command" | "script" | "patch";
export interface BulkPayloadBase {
  target: "agents";
  agents: string[];           // agent_id[]
  monType: "all" | "servers" | "workstations";
  osType: "all" | AgentPlat;
  mode: BulkMode;
}
export type BulkPayload =
  | (BulkPayloadBase & {
      mode: "command";
      cmd: string;
      shell: "cmd" | "powershell" | "/bin/bash" | "custom";
      custom_shell?: string;
      timeout: number;
      run_as_user: boolean;
    })
  | (BulkPayloadBase & {
      mode: "script";
      script: number;
      args: string[];
      timeout: number;
      run_as_user: boolean;
      env_vars: string[];
      custom_field?: number | null;
      collector_all_output?: boolean;
      save_to_agent_note?: boolean;
    })
  | (BulkPayloadBase & {
      mode: "patch";
      patchMode: "install" | "scan";
    });

export async function bulkAction(payload: BulkPayload): Promise<string> {
  const { data } = await axios.post<string>("/agents/actions/bulk/", payload, authConfig());
  return typeof data === "string" ? data : "";
}


// ── Phase K: bulk-op endpoints (reboot/shutdown/uninstall/recover-services/notify) ──
// These reuse the same /agents/actions/bulk/ entrypoint with new modes.
// The backend creates an AgentBulkOpJob row and returns {job_id, message}.
export type BulkOp =
  | "reboot"
  | "shutdown"
  | "uninstall"
  | "recover-services"
  | "notify";

export interface BulkOpResponse {
  job_id: number;
  message: string;
}

export async function dispatchBulkOp(
  op: BulkOp,
  agent_ids: string[],
  extra: { message?: string } = {},
): Promise<BulkOpResponse> {
  const payload: Record<string, unknown> = {
    mode: op,
    target: "agents",
    agents: agent_ids,
    monType: "all",
    osType: "all",
    ...(op === "notify" ? { message: extra.message ?? "" } : {}),
  };
  const { data } = await axios.post<BulkOpResponse>(
    "/agents/actions/bulk/",
    payload,
    authConfig(),
  );
  return data;
}

export interface BulkOpJobRow {
  id: number;
  op: string;
  status: "dispatching" | "running" | "done" | "partial" | "failed";
  total_agents: number;
  dispatched_count: number;
  failed_count: number;
  message: string;
  options: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
  created_by: string | null;
}

export async function fetchBulkOpJobs(limit = 25): Promise<BulkOpJobRow[]> {
  const { data } = await axios.get<BulkOpJobRow[]>(
    `/agents/bulk/jobs/?limit=${limit}`,
    authConfig(),
  );
  return data;
}

// ── Phase K: install-agent installer endpoint ────────────────────────────────
// Verified shape: POST /agents/installer/ returns either a binary blob (exe/ps1/sh)
// or a JSON {cmd, url} for manual/mac. This wrapper returns JSON only — the
// blob-download path is handled in the wizard component directly with a
// responseType:"blob" call.
export interface InstallerJSONResponse {
  cmd: string;
  url: string;
}
export interface InstallerRequest {
  installMethod: "exe" | "powershell" | "manual" | "bash" | "mac";
  client: number;
  site: number;
  expires: number;
  agenttype: "server" | "workstation";
  power: 0 | 1;
  rdp: 0 | 1;
  ping: 0 | 1;
  goarch: string;
  api: string;
  fileName: string;
  plat: "windows" | "linux" | "darwin";
}

export async function generateInstallerJSON(
  req: InstallerRequest,
): Promise<InstallerJSONResponse> {
  const { data } = await axios.post<InstallerJSONResponse>(
    "/agents/installer/",
    req,
    authConfig(),
  );
  return data;
}

export async function generateInstallerBlob(
  req: InstallerRequest,
): Promise<Blob> {
  const { data } = await axios.post<Blob>(
    "/agents/installer/",
    req,
    { ...authConfig(), responseType: "blob" },
  );
  return data;
}
