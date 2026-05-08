// Phase S — Roles store.

import { defineStore } from "pinia";
import {
  fetchRoles,
  saveRole,
  editRole,
  removeRole,
} from "@/api/accounts";

// Captures the small subset we display in the table; the full Role record
// has dozens of perm booleans, which we treat as a flat key/value bag in
// the form drawer.
export interface RoleRow {
  id: number;
  name: string;
  user_count: number;
  is_superuser: boolean;
  // all the can_* booleans appear here too via "fields = '__all__'", but the
  // table only renders the columns above.
  [perm: string]: unknown;
}

export const useRolesStore = defineStore("roles", {
  state: () => ({
    rows: [] as RoleRow[],
    loading: false,
    error: null as string | null,
    filters: { search: "" },
  }),

  getters: {
    filteredRows(state): RoleRow[] {
      const q = state.filters.search.trim().toLowerCase();
      if (!q) return state.rows;
      return state.rows.filter((r) =>
        r.name.toLowerCase().includes(q),
      );
    },
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchRoles();
        this.rows = (data ?? []) as RoleRow[];
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },
    async create(payload: Partial<RoleRow>) {
      await saveRole(payload);
      await this.load();
    },
    async update(id: number, payload: Partial<RoleRow>) {
      await editRole(id, payload);
      await this.load();
    },
    async remove(id: number) {
      await removeRole(id);
      await this.load();
    },
  },
});
