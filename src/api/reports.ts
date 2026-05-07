// Phase G — compliance reports API helpers. Mirrors backend reports/views.py.
// All endpoints accept the same filter set (range/client_id/site_id) plus the
// view-specific shape. CSV export uses the URL builder helpers below — the
// browser handles the download via window.location, no axios needed.

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

export type ReportRange = "7" | "30" | "90" | "all";

export interface ReportFiltersInput {
  range?: ReportRange;
  client_id?: number | null;
  site_id?: number | null;
}

export interface ReportFiltersResolved {
  range: ReportRange;
  since: string | null;
  until: string;
  client_id: number | null;
  site_id: number | null;
}

function paramsFor(filters: ReportFiltersInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.range) out.range = filters.range;
  if (filters.client_id != null) out.client_id = String(filters.client_id);
  if (filters.site_id != null) out.site_id = String(filters.site_id);
  return out;
}

export interface ReportIndexEntry {
  key: string;
  name: string;
  icon: string;
  lede: string;
  last_generated_at: string | null;
}

export async function listReports(): Promise<ReportIndexEntry[]> {
  const r = await axios.get<{ reports: ReportIndexEntry[] }>(
    "/reports/", authConfig(),
  );
  return r.data.reports;
}

// ── Patch Compliance ───────────────────────────────────────────────────
export interface PatchComplianceRow {
  policy_id: number;
  app_id: number;
  app_name: string;
  publisher: string;
  package_source: string;
  package_id: string;
  latest_version_known: string;
  installed_count: number;
  up_to_date_count: number;
  outdated_count: number;
  compliance_pct: number;
}
export interface PatchComplianceResponse {
  filters: ReportFiltersResolved;
  summary: {
    policy_count: number;
    total_installs_managed: number;
    up_to_date_count: number;
    outdated_count: number;
    fleet_compliance_pct: number;
  };
  rows: PatchComplianceRow[];
}
export async function getPatchCompliance(
  filters: ReportFiltersInput = {},
): Promise<PatchComplianceResponse> {
  const r = await axios.get<PatchComplianceResponse>(
    "/reports/patch-compliance/",
    authConfig({ params: paramsFor(filters) }),
  );
  return r.data;
}

// ── Software Inventory ─────────────────────────────────────────────────
export interface SoftwareInventoryResponse {
  filters: ReportFiltersResolved;
  summary: {
    total_distinct_apps: number;
    managed_count: number;
    unmanaged_count: number;
    agents_with_inventory: number;
    agents_without_inventory: number;
  };
  top_apps: Array<{ app_id: number; name: string; publisher: string; agent_count: number }>;
  top_publishers: Array<{ publisher: string; install_count: number }>;
  top_agents: Array<{ agent_id: number; hostname: string; install_count: number }>;
  agents_no_inventory: Array<{ agent_id: number; hostname: string }>;
}
export async function getSoftwareInventory(
  filters: ReportFiltersInput = {},
): Promise<SoftwareInventoryResponse> {
  const r = await axios.get<SoftwareInventoryResponse>(
    "/reports/software-inventory/",
    authConfig({ params: paramsFor(filters) }),
  );
  return r.data;
}

// ── Outdated Apps ──────────────────────────────────────────────────────
export interface OutdatedAppsRow {
  agent_id: string;
  hostname: string;
  client_name: string;
  site_name: string;
  outdated_count: number;
  outdated_apps: Array<{
    app_id: number;
    name: string;
    installed_version: string;
    latest_version: string;
  }>;
}
export interface OutdatedAppsResponse {
  filters: ReportFiltersResolved;
  summary: {
    total_agents: number;
    agents_with_outdated: number;
    histogram: Record<string, number>;
  };
  agents: OutdatedAppsRow[];
}
export async function getOutdatedApps(
  filters: ReportFiltersInput = {},
): Promise<OutdatedAppsResponse> {
  const r = await axios.get<OutdatedAppsResponse>(
    "/reports/outdated-apps/",
    authConfig({ params: paramsFor(filters) }),
  );
  return r.data;
}

// ── Agent Coverage ─────────────────────────────────────────────────────
export interface AgentCoverageRow {
  agent_id: string;
  hostname: string;
  client_name: string;
  site_name: string;
  managed_apps_total: number;
  covered_count: number;
  up_to_date_count: number;
  outdated_count: number;
  outdated_apps: Array<{ app_id: number; version: string; latest: string }>;
}
export interface AgentCoverageResponse {
  filters: ReportFiltersResolved;
  summary: {
    total_agents: number;
    agents_fully_compliant: number;
    agents_partial: number;
    agents_uncovered: number;
    managed_apps_total: number;
  };
  agents: AgentCoverageRow[];
}
export async function getAgentCoverage(
  filters: ReportFiltersInput = {},
): Promise<AgentCoverageResponse> {
  const r = await axios.get<AgentCoverageResponse>(
    "/reports/agent-coverage/",
    authConfig({ params: paramsFor(filters) }),
  );
  return r.data;
}

// ── Deploy History ─────────────────────────────────────────────────────
export interface DeployHistoryJob {
  id: number;
  kind: string;
  status: string;
  package_source: string;
  package_id: string;
  package_name: string;
  total_agents: number;
  dispatched_count: number;
  skipped_count: number;
  succeeded_count: number;
  failed_count: number;
  created_at: string | null;
  updated_at: string | null;
}
export interface DeployHistoryResponse {
  filters: ReportFiltersResolved;
  summary: {
    total_jobs: number;
    succeeded: number;
    partial: number;
    failed: number;
    awaiting_completion: number;
    success_rate_pct: number;
    partial_rate_pct: number;
    failure_rate_pct: number;
    avg_completion_seconds: number;
  };
  jobs: DeployHistoryJob[];
}
export async function getDeployHistory(
  filters: ReportFiltersInput = {},
): Promise<DeployHistoryResponse> {
  const r = await axios.get<DeployHistoryResponse>(
    "/reports/deploy-history/",
    authConfig({ params: paramsFor(filters) }),
  );
  return r.data;
}

// ── CSV download URL builder ────────────────────────────────────────────
// Returns a URL with output=csv plus the auth token in the query string so
// the browser's native download flow can fetch it without our axios setup.
// Knox tokens are accepted via Authorization header normally; for a same-
// origin link click we rely on the SPA's authenticated session cookie OR a
// short-lived ?token= param (legacy TRMM admin URLs use the same trick).
export function csvUrl(
  reportKey: string,
  filters: ReportFiltersInput = {},
): string {
  const params = new URLSearchParams(paramsFor(filters));
  params.set("output", "csv");
  return `/reports/${reportKey}/?${params.toString()}`;
}
