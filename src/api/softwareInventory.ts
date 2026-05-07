// Phase D + E — software inventory API helpers.
//
// Backend contract (see api/tacticalrmm/software/):
//   GET  /software/apps/summary/                  → { distinct_apps, agents_with_inventory, managed_apps }
//   GET  /software/apps/                          → DRF paginated InstalledAppListSerializer
//   GET  /software/apps/<id>/                     → InstalledAppDetailSerializer
//   GET  /software/apps/<id>/agents/              → DRF paginated AgentInstalledAppSerializer
//   GET  /software/apps/<id>/candidates/          → { app_id, candidates: PackageMatch[] }
//   POST /software/apps/<id>/take-over/           → InstalledAppDetailSerializer (post takeover)
//   POST /software/apps/<id>/release/             → InstalledAppDetailSerializer (post release)
//   POST /software/apps/<id>/force-update/        → { app_id, dispatched, dispatched_agent_pks, skipped }
//
// File previously named src/api/software.ts but renamed to disambiguate
// from the legacy software.js (which exports per-agent install/uninstall
// helpers used by the upstream pages we left untouched).

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

// ── Types ──────────────────────────────────────────────────────────────

export interface InventorySummary {
  distinct_apps: number;
  agents_with_inventory: number;
  managed_apps: number;
}

export interface InstalledAppListRow {
  id: number;
  name: string;
  publisher: string;
  homepage_url: string;
  installation_count: number;
  version_count_distinct: number;
  latest_seen_version: string;
  oldest_seen_version: string;
  is_managed: boolean;
  has_package_match: boolean;
  package_match_source: string | null;
  package_match_id_str: string | null;
  updated_at: string;
}

export interface InstalledAppDetail extends InstalledAppListRow {
  name_normalized: string;
  publisher_normalized: string;
  package_match: {
    id: number;
    source: string;
    package_id: string;
    display_name: string;
    publisher: string;
    latest_version_known: string;
    last_refreshed_at: string | null;
  } | null;
  version_distribution: Array<{ version: string; count: number }>;
  created_at: string;
}

export interface PackageCandidate {
  source: "choco" | "winget" | "wuauserv";
  package_id: string;
  display_name: string;
  publisher: string;
  homepage_url: string;
  score: number;
  reason: string;
}

export interface CandidatesResponse {
  app_id: number;
  candidates: PackageCandidate[];
  matched_count: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TakeOverPayload {
  source: string;
  package_id: string;
  display_name: string;
  publisher: string;
  policy: {
    auto_update_enabled: boolean;
    reboot_required_strategy: "defer" | "prompt" | "force";
    maintenance_window_id: number | null;
  };
}

export interface ForceUpdateResponse {
  app_id: number;
  package: string;
  dispatched: number;
  dispatched_agent_pks: number[];
  skipped: Array<{ agent_id: string; reason: string }>;
}

export interface AppListParams {
  search?: string;
  is_managed?: boolean;
  has_package_match?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// ── Phase D ────────────────────────────────────────────────────────────

export async function getInventorySummary(): Promise<InventorySummary> {
  const r = await axios.get<InventorySummary>(
    "/software/apps/summary/",
    authConfig(),
  );
  return r.data;
}

export async function listInstalledApps(
  params: AppListParams = {},
): Promise<PaginatedResponse<InstalledAppListRow>> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.is_managed !== undefined) qs.set("is_managed", String(params.is_managed));
  if (params.has_package_match !== undefined)
    qs.set("has_package_match", String(params.has_package_match));
  if (params.ordering) qs.set("ordering", params.ordering);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const url = "/software/apps/" + (qs.toString() ? "?" + qs.toString() : "");
  const r = await axios.get<PaginatedResponse<InstalledAppListRow>>(
    url,
    authConfig(),
  );
  return r.data;
}

// ── Phase E ────────────────────────────────────────────────────────────

export async function getAppDetail(id: number): Promise<InstalledAppDetail> {
  const r = await axios.get<InstalledAppDetail>(
    `/software/apps/${id}/`,
    authConfig(),
  );
  return r.data;
}

export async function getAppCandidates(id: number): Promise<CandidatesResponse> {
  const r = await axios.get<CandidatesResponse>(
    `/software/apps/${id}/candidates/`,
    authConfig(),
  );
  return r.data;
}

export async function takeOverApp(
  id: number,
  payload: TakeOverPayload,
): Promise<InstalledAppDetail> {
  const r = await axios.post<InstalledAppDetail>(
    `/software/apps/${id}/take-over/`,
    payload,
    authConfig(),
  );
  return r.data;
}

export async function releaseApp(id: number): Promise<InstalledAppDetail> {
  const r = await axios.post<InstalledAppDetail>(
    `/software/apps/${id}/release/`,
    {},
    authConfig(),
  );
  return r.data;
}

export async function forceUpdateApp(id: number): Promise<ForceUpdateResponse> {
  const r = await axios.post<ForceUpdateResponse>(
    `/software/apps/${id}/force-update/`,
    {},
    authConfig(),
  );
  return r.data;
}
