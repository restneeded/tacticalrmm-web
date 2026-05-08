// Phase S — API keys store.

import { defineStore } from "pinia";
import {
  fetchAPIKeys,
  saveAPIKey,
  editAPIKey,
  removeAPIKey,
} from "@/api/accounts";

export interface ApiKeyRow {
  id: number;
  name: string;
  key: string;
  username: string;
  user: number;
  expiration: string | null;
}

export const useApiKeysStore = defineStore("apiKeys", {
  state: () => ({
    rows: [] as ApiKeyRow[],
    loading: false,
    error: null as string | null,
    filters: { search: "" },
  }),

  getters: {
    filteredRows(state): ApiKeyRow[] {
      const q = state.filters.search.trim().toLowerCase();
      if (!q) return state.rows;
      return state.rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.username ?? "").toLowerCase().includes(q),
      );
    },
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchAPIKeys();
        this.rows = (data ?? []) as ApiKeyRow[];
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },

    /** Returns the freshly-created row so the page can show its key once. */
    async create(payload: { name: string; user: number; expiration?: string | null }): Promise<ApiKeyRow | null> {
      await saveAPIKey(payload);
      await this.load();
      // Re-find the newly created key by name (names are unique per the model).
      return this.rows.find((r) => r.name === payload.name) ?? null;
    },

    async update(id: number, payload: Partial<ApiKeyRow>) {
      await editAPIKey(id, payload);
      await this.load();
    },

    async remove(id: number) {
      await removeAPIKey(id);
      await this.load();
    },
  },
});
