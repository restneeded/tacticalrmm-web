// Phase I — saved views for the Clients & Sites table.
// Mirrors stores/devicesView.ts but stamps `kind: "clients-sites"` so the
// SavedView server model keeps the views distinct from /devices views.

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";

import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  migrateLocalViews,
  updateSavedView,
} from "@/api/savedViews";
import {
  DEFAULT_FILTERS,
  type FilterState,
  type SortState,
  type Density,
} from "@/stores/clientsSites";

export interface ClientsSitesView {
  id: string;
  serverId?: number;
  name: string;
  filters: FilterState;
  sort: SortState;
  visibleColumns: string[];
  density: Density;
  groupByClient: boolean;
  isShared?: boolean;
  ownerUsername?: string;
}

const BUILTIN_VIEWS: ClientsSitesView[] = [
  {
    id: "builtin:all-clients",
    name: "All clients",
    filters: { ...DEFAULT_FILTERS },
    sort: { by: "client_name", desc: false },
    visibleColumns: [
      "client_name", "site_name", "workstations", "servers",
      "agent_count", "failing_checks", "patches_pending", "last_seen",
    ],
    density: "cozy",
    groupByClient: false,
  },
  {
    id: "builtin:failing-checks",
    name: "Clients with failing checks",
    filters: { ...DEFAULT_FILTERS, failingChecks: true },
    sort: { by: "failing_checks", desc: true },
    visibleColumns: [
      "client_name", "site_name", "agent_count",
      "failing_checks", "last_seen",
    ],
    density: "cozy",
    groupByClient: false,
  },
  {
    id: "builtin:empty-sites",
    name: "Empty sites",
    filters: { ...DEFAULT_FILTERS, emptySites: true },
    sort: { by: "client_name", desc: false },
    visibleColumns: [
      "client_name", "site_name", "agent_count", "last_seen",
    ],
    density: "cozy",
    groupByClient: false,
  },
];

const MIGRATION_DONE_KEY = "clientsSites:savedViews:serverMigrationDone";

interface AxiosLike {
  response?: { data?: { detail?: string } };
  message?: string;
}
function errMsg(e: unknown, fallback = "unknown sync error"): string {
  const a = e as AxiosLike | undefined;
  return a?.response?.data?.detail || a?.message || fallback;
}

function viewToQuery(v: Omit<ClientsSitesView, "id" | "name" | "serverId">): Record<string, unknown> {
  return {
    filters: v.filters,
    sort: v.sort,
    visibleColumns: v.visibleColumns,
    density: v.density,
    groupByClient: v.groupByClient,
  };
}
function queryToView(q: Record<string, unknown>): Omit<ClientsSitesView, "id" | "name" | "serverId"> {
  const filters = (q.filters as FilterState | undefined) ?? { ...DEFAULT_FILTERS };
  const sort = (q.sort as SortState | undefined) ?? { by: "client_name", desc: false };
  const visibleColumns = (q.visibleColumns as string[] | undefined) ?? [];
  const density = (q.density as Density | undefined) ?? "cozy";
  const groupByClient = (q.groupByClient as boolean | undefined) ?? false;
  return { filters, sort, visibleColumns, density, groupByClient };
}

export const useClientsSitesViewStore = defineStore("clientsSitesView", {
  state: () => ({
    user: useStorage<ClientsSitesView[]>("clientsSites:savedViews", []),
    activeId: useStorage<string | null>("clientsSites:activeViewId", null),
    syncing: false,
    lastSyncError: null as string | null,
  }),

  getters: {
    builtin(): ClientsSitesView[] {
      return BUILTIN_VIEWS;
    },
    all(state): ClientsSitesView[] {
      return [...BUILTIN_VIEWS, ...state.user];
    },
    activeView(state): ClientsSitesView | null {
      if (!state.activeId) return null;
      return this.all.find((v) => v.id === state.activeId) || null;
    },
  },

  actions: {
    async syncFromServer(): Promise<void> {
      if (this.syncing) return;
      this.syncing = true;
      this.lastSyncError = null;
      try {
        if (!localStorage.getItem(MIGRATION_DONE_KEY)) {
          const local = (this.user as ClientsSitesView[]).filter(
            (v) => v.id.startsWith("user:"),
          );
          if (local.length > 0) {
            await migrateLocalViews(
              "clients-sites",
              local.map((v) => ({ name: v.name, query: viewToQuery(v) })),
            );
          }
          localStorage.setItem(MIGRATION_DONE_KEY, "1");
        }

        const rows = await listSavedViews("clients-sites");
        this.user = rows.map((r) => ({
          id: `srv:${r.id}`,
          serverId: r.id,
          name: r.name,
          isShared: r.is_shared,
          ownerUsername: r.owner_username,
          ...queryToView(r.query as Record<string, unknown>),
        }));
      } catch (e) {
        this.lastSyncError = errMsg(e);
      } finally {
        this.syncing = false;
      }
    },

    async save(
      name: string,
      snapshot: Omit<ClientsSitesView, "id" | "name" | "serverId">,
      opts: { isShared?: boolean } = {},
    ): Promise<ClientsSitesView> {
      try {
        const created = await createSavedView({
          kind: "clients-sites",
          name,
          query: viewToQuery(snapshot),
          is_shared: !!opts.isShared,
        });
        const view: ClientsSitesView = {
          id: `srv:${created.id}`,
          serverId: created.id,
          name: created.name,
          isShared: created.is_shared,
          ownerUsername: created.owner_username,
          ...snapshot,
        };
        this.user.push(view);
        this.activeId = view.id;
        return view;
      } catch (e) {
        const local: ClientsSitesView = {
          id: `user:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          ...snapshot,
        };
        this.user.push(local);
        this.activeId = local.id;
        this.lastSyncError = errMsg(e, "save-failed");
        return local;
      }
    },

    async remove(id: string): Promise<void> {
      if (id.startsWith("builtin:")) return;
      const v = this.user.find((x) => x.id === id);
      if (v?.serverId !== undefined) {
        try {
          await deleteSavedView(v.serverId);
        } catch (e) {
          this.lastSyncError = errMsg(e, "delete-failed");
          return;
        }
      }
      this.user = this.user.filter((x) => x.id !== id);
      if (this.activeId === id) this.activeId = null;
    },

    async setShared(id: string, isShared: boolean): Promise<void> {
      const v = this.user.find((x) => x.id === id);
      if (!v || v.serverId === undefined) return;
      try {
        const updated = await updateSavedView(v.serverId, { is_shared: isShared });
        v.isShared = updated.is_shared;
      } catch (e) {
        this.lastSyncError = errMsg(e, "share-toggle-failed");
      }
    },

    setActive(id: string | null) {
      this.activeId = id;
    },
  },
});
