// Phase C — saved views (filter + sort + columns + density).
// Phase G: backed by the SavedView server model with a localStorage mirror
// for sync-fast reads. The first call to syncFromServer() does a one-shot,
// idempotent migration of any legacy local-only rows into the server.

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
} from "@/stores/devices";

export interface DevicesView {
  // Phase G: server views use numeric primary keys; local-only views (pre-
  // migration) keep their `user:...` string id. The id type stays `string`
  // because the SPA always handles ids as strings — server ids get
  // String()'d when ingested. ``serverId`` is the raw numeric id when
  // available; mutators use it for round-tripping changes.
  id: string;
  serverId?: number;
  name: string;
  filters: FilterState;
  sort: SortState;
  visibleColumns: string[];
  density: Density;
  isShared?: boolean;
  ownerUsername?: string;
}

// Three views ship by default — they answer common admin questions and let
// users see what a "view" is supposed to look like.
const BUILTIN_VIEWS: DevicesView[] = [
  {
    id: "builtin:servers-failing",
    name: "Servers with failing checks",
    filters: { ...DEFAULT_FILTERS, monType: "server", hasFailingChecks: true },
    sort: { by: "checks_failing", desc: true },
    visibleColumns: [
      "status", "hostname", "client_name", "site_name", "operating_system",
      "checks_failing", "last_seen", "needs_reboot",
    ],
    density: "cozy",
  },
  {
    id: "builtin:offline-week",
    name: "Offline >7 days",
    filters: { ...DEFAULT_FILTERS, status: "offline" },
    sort: { by: "last_seen", desc: false },
    visibleColumns: [
      "status", "hostname", "client_name", "site_name",
      "operating_system", "last_seen", "logged_username",
    ],
    density: "cozy",
  },
  {
    id: "builtin:reboot-pending",
    name: "Reboot pending",
    filters: { ...DEFAULT_FILTERS, needsReboot: true },
    sort: { by: "hostname", desc: false },
    visibleColumns: [
      "status", "hostname", "client_name", "site_name",
      "operating_system", "needs_reboot", "last_seen",
    ],
    density: "cozy",
  },
];

// Marker key set after a successful one-shot localStorage→server migration.
const MIGRATION_DONE_KEY = "devices:savedViews:serverMigrationDone";

interface AxiosLike {
  response?: { data?: { detail?: string } };
  message?: string;
}
function errMsg(e: unknown, fallback = "unknown sync error"): string {
  const a = e as AxiosLike | undefined;
  return a?.response?.data?.detail || a?.message || fallback;
}

function viewToQuery(v: Omit<DevicesView, "id" | "name" | "serverId">): Record<string, unknown> {
  return {
    filters: v.filters,
    sort: v.sort,
    visibleColumns: v.visibleColumns,
    density: v.density,
  };
}
function queryToView(q: Record<string, unknown>): Omit<DevicesView, "id" | "name" | "serverId"> {
  // Defensive parse — server may return a partial query if the SPA shape
  // ever drifts. Fall back to defaults rather than blowing up.
  const filters = (q.filters as FilterState | undefined) ?? { ...DEFAULT_FILTERS };
  const sort = (q.sort as SortState | undefined) ?? { by: "hostname", desc: false };
  const visibleColumns = (q.visibleColumns as string[] | undefined) ?? [];
  const density = (q.density as Density | undefined) ?? "cozy";
  return { filters, sort, visibleColumns, density };
}

export const useDevicesViewStore = defineStore("devicesView", {
  state: () => ({
    user: useStorage<DevicesView[]>("devices:savedViews", []),
    activeId: useStorage<string | null>("devices:activeViewId", null),
    syncing: false,
    lastSyncError: null as string | null,
  }),

  getters: {
    builtin(): DevicesView[] {
      return BUILTIN_VIEWS;
    },
    all(state): DevicesView[] {
      return [...BUILTIN_VIEWS, ...state.user];
    },
    activeView(state): DevicesView | null {
      if (!state.activeId) return null;
      return this.all.find((v) => v.id === state.activeId) || null;
    },
  },

  actions: {
    /** Fetch server views and replace the local user list. On the first
     * call ever (per browser), migrate any legacy local-only rows up to
     * the server first — idempotent on (user, devices, name). */
    async syncFromServer(): Promise<void> {
      if (this.syncing) return;
      this.syncing = true;
      this.lastSyncError = null;
      try {
        if (!localStorage.getItem(MIGRATION_DONE_KEY)) {
          // One-shot localStorage migration. Only push views that look
          // like user-created (id starts with "user:") — built-ins and
          // server-sourced rows shouldn't be pushed.
          const local = (this.user as DevicesView[]).filter(
            (v) => v.id.startsWith("user:"),
          );
          if (local.length > 0) {
            await migrateLocalViews(
              "devices",
              local.map((v) => ({ name: v.name, query: viewToQuery(v) })),
            );
          }
          localStorage.setItem(MIGRATION_DONE_KEY, "1");
        }

        const rows = await listSavedViews("devices");
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

    /** Persist a new saved view to the server, then mirror it locally. */
    async save(
      name: string,
      snapshot: Omit<DevicesView, "id" | "name" | "serverId">,
      opts: { isShared?: boolean } = {},
    ): Promise<DevicesView> {
      try {
        const created = await createSavedView({
          kind: "devices",
          name,
          query: viewToQuery(snapshot),
          is_shared: !!opts.isShared,
        });
        const view: DevicesView = {
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
        // Fallback — keep the local-only view so the user doesn't lose
        // their work. They can retry sync later.
        const local: DevicesView = {
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
          return; // don't drop locally if server delete failed
        }
      }
      this.user = this.user.filter((x) => x.id !== id);
      if (this.activeId === id) this.activeId = null;
    },

    async rename(id: string, name: string): Promise<void> {
      const v = this.user.find((x) => x.id === id);
      if (!v) return;
      v.name = name;
      if (v.serverId !== undefined) {
        try {
          await updateSavedView(v.serverId, { name });
        } catch (e) {
          this.lastSyncError = errMsg(e, "rename-failed");
        }
      }
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
