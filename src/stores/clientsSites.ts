// Phase I — Clients & Sites store.
//
// Holds the merged site rows and exposes filtered / sorted views. Reuses
// `useDevicesStore` to source the agents list — derived metrics
// (workstations/servers/online/patches/last-seen per site) are computed here
// in a getter rather than being a second network call.
//
// Writes (add/edit/delete client or site) go through the api wrapper in
// `@/api/clients`, then this store reloads `/clients/sites/` and invalidates
// the Phase F clientsCache so the deploy modal picker can't show stale data.

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import axios from "axios";

import { useDevicesStore } from "@/stores/devices";
import { useClientsCacheStore } from "@/stores/clientsCache";

import type { SiteRow } from "@/components/clientsSites/columns";

export type Density = "comfortable" | "cozy" | "compact";

export interface FilterState {
  search: string;
  failingChecks: boolean;
  emptySites: boolean;          // 0 agents
  hasAgents: boolean;           // >0 agents
  hasServers: boolean;
  hasWorkstations: boolean;
  client: string | null;        // client_name
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  failingChecks: false,
  emptySites: false,
  hasAgents: false,
  hasServers: false,
  hasWorkstations: false,
  client: null,
};

export interface SortState {
  by: string;
  desc: boolean;
}

const VISIBLE_DEFAULTS = [
  "client_name",
  "site_name",
  "workstations",
  "servers",
  "agent_count",
  "failing_checks",
  "patches_pending",
  "last_seen",
];

// Raw shape returned from /clients/ (nested sites). Note that the bare
// /clients/sites/ endpoint omits the per-site annotations (agent_count,
// failing_checks, maintenance_mode), so we always source rows from
// /clients/'s nested sites instead.
//
// `failing_checks` is the legacy {error, warning} shape from the model
// property — we collapse it to a count (0/1/2) at ingestion time.
interface ApiFailingChecks { error: boolean; warning: boolean }
interface ApiSiteNested {
  id: number;
  name: string;
  client: number;
  client_name: string;
  agent_count: number;
  failing_checks: ApiFailingChecks;
  maintenance_mode: boolean;
}
interface ApiClient {
  id: number;
  name: string;
  agent_count: number;
  failing_checks: ApiFailingChecks;
  maintenance_mode: boolean;
  sites: ApiSiteNested[];
}

function failingChecksCount(fc: ApiFailingChecks | undefined | null): number {
  if (!fc) return 0;
  return (fc.error ? 1 : 0) + (fc.warning ? 1 : 0);
}

export const useClientsSitesStore = defineStore("clientsSites", {
  state: () => ({
    // Raw — sourced from /clients/'s nested sites only.
    apiClients: [] as ApiClient[],

    loading: false,
    error: null as string | null,

    // Selection (sites)
    selected: [] as SiteRow[],

    // Filters
    filters: { ...DEFAULT_FILTERS } as FilterState,
    sort: { by: "client_name", desc: false } as SortState,

    // UI
    density: useStorage<Density>("clientsSites:density", "cozy"),
    visibleColumns: useStorage<string[]>("clientsSites:visibleColumns", [...VISIBLE_DEFAULTS]),
    groupByClient: useStorage<boolean>("clientsSites:groupByClient", false),
    rowsPerPage: useStorage<number>("clientsSites:rowsPerPage", 50),
    page: 1,
  }),

  getters: {
    /** Site rows merged with derived metrics from the agents list.
     *  AgentTableSerializer doesn't expose the site/client numeric ids, only
     *  `site_name` + `client_name`, so we bucket on the composite name.
     *  Site names aren't globally unique but `${client}::${site}` is. */
    rows(state): SiteRow[] {
      const devices = useDevicesStore();
      const agents = devices.rows;
      const byKey = new Map<string, typeof agents>();
      for (const a of agents) {
        const cn = a.client_name as string | undefined;
        const sn = a.site_name as string | undefined;
        if (!cn || !sn) continue;
        const k = `${cn}::${sn}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(a);
      }
      const out: SiteRow[] = [];
      for (const c of state.apiClients) {
        for (const s of c.sites) {
          const list = byKey.get(`${c.name}::${s.name}`) ?? [];
          let wTotal = 0, wOnline = 0, sTotal = 0, sOnline = 0, patches = 0;
          let last: string | null = null;
          for (const a of list) {
            const isWs = a.monitoring_type === "workstation";
            if (isWs) wTotal += 1; else sTotal += 1;
            if (a.status === "online") {
              if (isWs) wOnline += 1; else sOnline += 1;
            }
            if (a.has_patches_pending) patches += 1;
            const ls = a.last_seen as string | null;
            if (ls && (last === null || ls > last)) last = ls;
          }
          out.push({
            site_id: s.id,
            client_id: c.id,
            site_name: s.name,
            client_name: c.name,
            agent_count: s.agent_count ?? list.length,
            failing_checks: failingChecksCount(s.failing_checks),
            maintenance_mode: !!s.maintenance_mode,
            workstations_total: wTotal,
            workstations_online: wOnline,
            servers_total: sTotal,
            servers_online: sOnline,
            patches_pending: patches,
            last_seen: last,
          });
        }
      }
      return out;
    },

    /** Apply filters + sort. */
    filteredRows(state): SiteRow[] {
      const f = state.filters;
      const q = f.search.trim().toLowerCase();
      const out = (this.rows as SiteRow[]).filter((r) => {
        if (q && !(r.site_name.toLowerCase().includes(q) || r.client_name.toLowerCase().includes(q))) {
          return false;
        }
        if (f.client && r.client_name !== f.client) return false;
        if (f.failingChecks && r.failing_checks <= 0) return false;
        if (f.emptySites && r.agent_count > 0) return false;
        if (f.hasAgents && r.agent_count === 0) return false;
        if (f.hasServers && r.servers_total === 0) return false;
        if (f.hasWorkstations && r.workstations_total === 0) return false;
        return true;
      });
      const { by, desc } = state.sort;
      out.sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const av: any = (a as any)[by];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bv: any = (b as any)[by];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : 1;
        return desc ? -cmp : cmp;
      });
      return out;
    },

    /** Group-by-client roll-up rows. */
    groupedRows(): GroupedClientRow[] {
      const map = new Map<number, GroupedClientRow>();
      for (const r of this.filteredRows as SiteRow[]) {
        const g = map.get(r.client_id);
        if (g) {
          g.site_count += 1;
          g.agent_count += r.agent_count;
          g.failing_checks += r.failing_checks;
          g.workstations_total += r.workstations_total;
          g.workstations_online += r.workstations_online;
          g.servers_total += r.servers_total;
          g.servers_online += r.servers_online;
          g.patches_pending += r.patches_pending;
          if (r.last_seen && (g.last_seen === null || r.last_seen > g.last_seen)) {
            g.last_seen = r.last_seen;
          }
        } else {
          map.set(r.client_id, {
            client_id: r.client_id,
            client_name: r.client_name,
            site_count: 1,
            agent_count: r.agent_count,
            failing_checks: r.failing_checks,
            workstations_total: r.workstations_total,
            workstations_online: r.workstations_online,
            servers_total: r.servers_total,
            servers_online: r.servers_online,
            patches_pending: r.patches_pending,
            last_seen: r.last_seen,
          });
        }
      }
      return [...map.values()].sort((a, b) =>
        a.client_name.localeCompare(b.client_name) * (this.sort.desc ? -1 : 1),
      );
    },

    clientOptions(): string[] {
      const set = new Set<string>();
      for (const r of this.rows as SiteRow[]) set.add(r.client_name);
      return [...set].sort();
    },
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const devices = useDevicesStore();
        const agentsP = devices.rows.length === 0 ? devices.loadAgents() : Promise.resolve();
        const clientsR = await axios.get<ApiClient[]>("/clients/");
        await agentsP;
        this.apiClients = clientsR.data;
      } catch (e) {
        const m = (e as { message?: string }).message ?? "load-failed";
        this.error = m;
      } finally {
        this.loading = false;
      }
    },

    /** Re-fetch list-side data after a write. Also invalidates the Phase F
     *  clientsCache so the deploy-modal picker re-reads on next open. */
    async reloadAfterWrite(): Promise<void> {
      const cache = useClientsCacheStore();
      cache.invalidate();
      await this.load();
    },

    setFilter<K extends keyof FilterState>(k: K, v: FilterState[K]) {
      this.filters[k] = v;
      this.page = 1;
    },
    resetFilters() {
      this.filters = { ...DEFAULT_FILTERS };
      this.page = 1;
    },
    setSort(by: string, desc: boolean) {
      this.sort = { by, desc };
    },
    clearSelection() {
      this.selected = [];
    },
  },
});

export interface GroupedClientRow {
  client_id: number;
  client_name: string;
  site_count: number;
  agent_count: number;
  failing_checks: number;
  workstations_total: number;
  workstations_online: number;
  servers_total: number;
  servers_online: number;
  patches_pending: number;
  last_seen: string | null;
}
