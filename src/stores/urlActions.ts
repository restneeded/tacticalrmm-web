// Phase T2 — URL Actions store.

import { defineStore } from "pinia";

import {
  fetchURLActions,
  saveURLAction,
  editURLAction,
  removeURLAction,
} from "@/api/core";
import type { URLAction } from "@/types/core/urlactions";

export const useURLActionsStore = defineStore("urlActions", {
  state: () => ({
    rows: [] as URLAction[],
    loading: false,
    error: null as string | null,
    filters: { search: "" },
  }),

  getters: {
    filteredRows(state): URLAction[] {
      const q = state.filters.search.trim().toLowerCase();
      if (!q) return state.rows;
      return state.rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.desc ?? "").toLowerCase().includes(q) ||
          r.pattern.toLowerCase().includes(q),
      );
    },
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        this.rows = (await fetchURLActions()) ?? [];
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },

    async create(payload: URLAction): Promise<void> {
      await saveURLAction(payload);
      await this.load();
    },

    async update(id: number, payload: URLAction): Promise<void> {
      await editURLAction(id, payload);
      await this.load();
    },

    async remove(id: number): Promise<void> {
      await removeURLAction(id);
      await this.load();
    },
  },
});
