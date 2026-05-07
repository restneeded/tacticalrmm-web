// Phase G — SavedView API. Server-side counterpart to Phase C's
// localStorage views. The Pinia stores call into this, then mirror the
// result back into localStorage so reads can stay sync-fast.

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

export type SavedViewKind =
  | "devices"
  | "software-discovery"
  | "software-managed"
  | "dashboard-layout";

export interface SavedView {
  id: number;
  kind: SavedViewKind | string;
  name: string;
  query: Record<string, unknown>;
  is_shared: boolean;
  owner_username: string;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export async function listSavedViews(kind?: SavedViewKind): Promise<SavedView[]> {
  const params: Record<string, string> = {};
  if (kind) params.kind = kind;
  const r = await axios.get<SavedView[]>("/saved-views/", authConfig({ params }));
  return r.data;
}

export async function createSavedView(input: {
  kind: SavedViewKind;
  name: string;
  query: Record<string, unknown>;
  is_shared?: boolean;
}): Promise<SavedView> {
  const r = await axios.post<SavedView>("/saved-views/", input, authConfig());
  return r.data;
}

export async function updateSavedView(
  id: number,
  patch: Partial<Pick<SavedView, "name" | "query" | "is_shared">>,
): Promise<SavedView> {
  const r = await axios.put<SavedView>(`/saved-views/${id}/`, patch, authConfig());
  return r.data;
}

export async function deleteSavedView(id: number): Promise<void> {
  await axios.delete(`/saved-views/${id}/`, authConfig());
}

export async function migrateLocalViews(
  kind: SavedViewKind,
  views: Array<{ name: string; query: Record<string, unknown> }>,
): Promise<{ created: number; skipped: number; total: number }> {
  const r = await axios.post<{ created: number; skipped: number; total: number }>(
    "/saved-views/migrate/", { kind, views }, authConfig(),
  );
  return r.data;
}
