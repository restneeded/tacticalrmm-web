// Phase D — software inventory API helpers.
//
// Backend contract (see /opt/tacticalrmm-fork/tacticalrmm/api/.../software/):
//   GET /software/apps/summary/  → { distinct_apps, agents_with_inventory, managed_apps }
//   GET /software/apps/          → DRF paginated InstalledAppListSerializer
//   GET /software/apps/<id>/     → InstalledAppDetailSerializer
//   GET /software/apps/<id>/agents/ → DRF paginated AgentInstalledAppSerializer
//
// Phase D's UI only consumes the first two. Detail + agents are wired so
// Phase E's Discovery view can plug in without re-doing this layer.

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
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const r = await axios.get<InventorySummary>(
    "/software/apps/summary/",
    authConfig(),
  );
  return r.data;
}

export interface AppListParams {
  search?: string;
  is_managed?: boolean;
  has_package_match?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
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
