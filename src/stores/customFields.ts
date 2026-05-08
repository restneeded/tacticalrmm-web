// Phase T2 — Custom Fields store.

import { defineStore } from "pinia";

import {
  fetchCustomFields,
  saveCustomField,
  editCustomField,
  removeCustomField,
} from "@/api/core";
import type {
  CustomField,
  CustomFieldModel,
} from "@/types/core/customfields";

export interface CustomFieldFilterState {
  search: string;
  model: CustomFieldModel | "all";
}

const DEFAULT_FILTERS: CustomFieldFilterState = {
  search: "",
  model: "all",
};

export const useCustomFieldsStore = defineStore("customFields", {
  state: () => ({
    rows: [] as CustomField[],
    loading: false,
    error: null as string | null,
    filters: { ...DEFAULT_FILTERS } as CustomFieldFilterState,
  }),

  getters: {
    filteredRows(state): CustomField[] {
      const q = state.filters.search.trim().toLowerCase();
      const m = state.filters.model;
      return state.rows.filter((r) => {
        if (m !== "all" && r.model !== m) return false;
        if (!q) return true;
        return r.name.toLowerCase().includes(q);
      });
    },
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        this.rows = (await fetchCustomFields()) ?? [];
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },

    async create(payload: Partial<CustomField>): Promise<void> {
      await saveCustomField(payload);
      await this.load();
    },

    async update(id: number, payload: Partial<CustomField>): Promise<void> {
      await editCustomField(id, payload);
      await this.load();
    },

    async remove(id: number): Promise<void> {
      await removeCustomField(id);
      await this.load();
    },
  },
});
