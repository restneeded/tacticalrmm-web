// Phase C — saved views (filter + sort + columns + density), localStorage-only.
// A future phase can move this to a per-user backend setting; the contract
// (load → list → save → apply → remove) is what makes that swap cheap.

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";

import {
  DEFAULT_FILTERS,
  type FilterState,
  type SortState,
  type Density,
} from "@/stores/devices";

export interface DevicesView {
  id: string;            // crypto.randomUUID()-ish; we just use Date.now+rand
  name: string;
  filters: FilterState;
  sort: SortState;
  visibleColumns: string[];
  density: Density;
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

export const useDevicesViewStore = defineStore("devicesView", {
  state: () => ({
    user: useStorage<DevicesView[]>("devices:savedViews", []),
    activeId: useStorage<string | null>("devices:activeViewId", null),
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
    save(name: string, snapshot: Omit<DevicesView, "id" | "name">): DevicesView {
      const view: DevicesView = {
        id: `user:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        ...snapshot,
      };
      this.user.push(view);
      this.activeId = view.id;
      return view;
    },
    remove(id: string) {
      if (id.startsWith("builtin:")) return;
      this.user = this.user.filter((v) => v.id !== id);
      if (this.activeId === id) this.activeId = null;
    },
    rename(id: string, name: string) {
      const v = this.user.find((x) => x.id === id);
      if (v) v.name = name;
    },
    setActive(id: string | null) {
      this.activeId = id;
    },
  },
});
