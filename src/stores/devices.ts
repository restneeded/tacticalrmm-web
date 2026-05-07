// Phase C — devices store.
//
// Why client-side filter/sort: GET /agents/ returns the full fleet in one
// payload (no server pagination). For hundreds of agents this is fine; we
// virtualise rendering and filter/sort in-memory.
//
// State persisted to localStorage:
//   columns visibility, density, last-applied filters (transient — saved views
//   are a separate store).

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";

import { fetchAgents, type AgentRow, type AgentMonType, type AgentPlat } from "@/api/devices";

export type Density = "comfortable" | "cozy" | "compact";

export interface FilterState {
  search: string;
  monType: "all" | AgentMonType;
  osFamily: "all" | AgentPlat;
  status: "all" | "online" | "offline" | "overdue";
  client: string | null;            // client_name (rows are denormalised)
  site: string | null;              // site_name
  hasFailingChecks: boolean;
  hasPatchesPending: boolean;
  needsReboot: boolean;
  hasPendingActions: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  monType: "all",
  osFamily: "all",
  status: "all",
  client: null,
  site: null,
  hasFailingChecks: false,
  hasPatchesPending: false,
  needsReboot: false,
  hasPendingActions: false,
};

export interface SortState {
  by: keyof AgentRow | "checks_failing";
  desc: boolean;
}

// Default columns + their visibility. Used by the column picker.
export interface ColumnDef {
  name: string;            // q-table column key
  label: string;           // header label
  field: keyof AgentRow | ((row: AgentRow) => unknown);
  sortable?: boolean;
  align?: "left" | "right" | "center";
  format?: (val: unknown, row: AgentRow) => string;
}

// q-table column metadata is defined inside the Vue component so it can use
// formatters. The store only owns the *visibility* + density + sort state.

const VISIBLE_DEFAULTS = [
  "status",
  "hostname",
  "client_name",
  "site_name",
  "monitoring_type",
  "operating_system",
  "logged_username",
  "last_seen",
  "checks_failing",
  "needs_reboot",
];

export const useDevicesStore = defineStore("devices", {
  state: () => ({
    // raw data
    rows: [] as AgentRow[],
    loading: false,
    error: null as string | null,
    lastFetchedAt: null as number | null,

    // selection
    selected: [] as AgentRow[],

    // filters (transient — restored via saved views, not persisted directly)
    filters: { ...DEFAULT_FILTERS } as FilterState,

    // sort
    sort: { by: "hostname", desc: false } as SortState,

    // ui
    density: useStorage<Density>("devices:density", "cozy"),
    visibleColumns: useStorage<string[]>("devices:visibleColumns", [...VISIBLE_DEFAULTS]),
    page: 1,
    rowsPerPage: useStorage<number>("devices:rowsPerPage", 50),
  }),

  getters: {
    // De-duped lists for filter dropdowns
    clientOptions(state): string[] {
      const set = new Set<string>();
      for (const r of state.rows) if (r.client_name) set.add(r.client_name);
      return [...set].sort();
    },
    siteOptions(state): string[] {
      const set = new Set<string>();
      for (const r of state.rows) {
        if (!state.filters.client || r.client_name === state.filters.client) {
          if (r.site_name) set.add(r.site_name);
        }
      }
      return [...set].sort();
    },
    osFamilyOptions(state): string[] {
      const set = new Set<string>();
      for (const r of state.rows) if (r.plat) set.add(r.plat);
      return [...set].sort();
    },

    // Filtered + sorted rows (the table consumes this)
    filteredRows(state): AgentRow[] {
      const f = state.filters;
      const q = f.search.trim().toLowerCase();

      let rows = state.rows.filter((r) => {
        if (f.monType !== "all" && r.monitoring_type !== f.monType) return false;
        if (f.osFamily !== "all" && r.plat !== f.osFamily) return false;
        if (f.status !== "all" && r.status !== f.status) return false;
        if (f.client && r.client_name !== f.client) return false;
        if (f.site && r.site_name !== f.site) return false;
        if (f.hasFailingChecks && !r.checks?.has_failing_checks) return false;
        if (f.hasPatchesPending && !r.has_patches_pending) return false;
        if (f.needsReboot && !r.needs_reboot) return false;
        if (f.hasPendingActions && (r.pending_actions_count ?? 0) === 0) return false;

        if (!q) return true;
        // Multi-field text match — same fields the legacy table searches.
        const hay =
          (r.hostname || "") +
          " " + (r.client_name || "") +
          " " + (r.site_name || "") +
          " " + (r.operating_system || "") +
          " " + (r.logged_username || "") +
          " " + (r.public_ip || "") +
          " " + (r.local_ips || "") +
          " " + (r.description || "");
        return hay.toLowerCase().includes(q);
      });

      // Sort
      const { by, desc } = state.sort;
      rows = [...rows].sort((a, b) => {
        const av = sortKey(a, by);
        const bv = sortKey(b, by);
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av < bv ? -1 : 1) * (desc ? -1 : 1);
      });

      return rows;
    },

    // Page-sliced for the table
    pageRows(): AgentRow[] {
      const filtered = this.filteredRows;
      if (this.rowsPerPage === 0) return filtered;
      const start = (this.page - 1) * this.rowsPerPage;
      return filtered.slice(start, start + this.rowsPerPage);
    },

    selectedIds(state): string[] {
      return state.selected.map((r) => r.agent_id);
    },
  },

  actions: {
    async loadAgents(opts: { force?: boolean } = {}) {
      // 30s freshness window — re-renders during HMR shouldn't trigger refetch.
      const fresh = this.lastFetchedAt && Date.now() - this.lastFetchedAt < 30_000;
      if (fresh && !opts.force && this.rows.length) return;

      this.loading = true;
      this.error = null;
      try {
        this.rows = await fetchAgents();
        this.lastFetchedAt = Date.now();
      } catch (e) {
        const msg = (e as Error)?.message || "Failed to load agents";
        this.error = msg;
        this.rows = [];
      } finally {
        this.loading = false;
      }
    },

    setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
      this.filters[key] = value;
      // Reset paging when filter changes — Intune behavior.
      this.page = 1;
    },

    resetFilters() {
      this.filters = { ...DEFAULT_FILTERS };
      this.page = 1;
    },

    setSort(by: SortState["by"], desc: boolean) {
      this.sort = { by, desc };
    },

    clearSelection() {
      this.selected = [];
    },

    // Optimistic patch — updates the row in-place; caller reverts on error.
    patchRow(agent_id: string, patch: Partial<AgentRow>) {
      const r = this.rows.find((x) => x.agent_id === agent_id);
      if (r) Object.assign(r, patch);
    },
  },
});

function sortKey(row: AgentRow, by: SortState["by"]): string | number | null {
  if (by === "checks_failing") return row.checks?.failing ?? 0;
  const v = row[by] as unknown;
  if (v == null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  return String(v).toLowerCase();
}
