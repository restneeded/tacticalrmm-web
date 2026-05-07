// Phase G — per-user dashboard tile order + visibility.
//
// HomeView ships a default tile order (the canonical 7-tile layout from
// Phase B). This store overlays the user's preference on top of that:
// hidden tiles are filtered out, and visible tiles render in the user's
// preferred order. New tiles introduced after the user saved their
// layout get appended to the end (so a future tile is shown by default,
// not silently dropped).
//
// Backed by the SavedView server model (kind=dashboard-layout, name=
// "default"), with a localStorage mirror for sync-fast reads. Saving
// "" or a missing entry means "use the canonical default" — i.e. the
// store starts opt-in.

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";

import {
  createSavedView,
  listSavedViews,
  updateSavedView,
} from "@/api/savedViews";

export interface DashboardLayout {
  /** Canonical tile-id order. */
  order: string[];
  /** Tile-ids hidden by the user. */
  hidden: string[];
}

const EMPTY: DashboardLayout = { order: [], hidden: [] };

interface AxiosLike {
  response?: { data?: { detail?: string } };
  message?: string;
}
function layoutErrMsg(e: unknown, fallback = "unknown sync error"): string {
  const a = e as AxiosLike | undefined;
  return a?.response?.data?.detail || a?.message || fallback;
}

export const useDashboardLayoutStore = defineStore("dashboardLayout", {
  state: () => ({
    layout: useStorage<DashboardLayout>("dashboard:layout", { ...EMPTY }),
    serverId: useStorage<number | null>("dashboard:layout:serverId", null),
    syncing: false,
    lastSyncError: null as string | null,
  }),

  actions: {
    /** Pull from server. If no row exists yet, leaves local layout in
     * place (a freshly seeded user starts with empty layout = canonical). */
    async syncFromServer(): Promise<void> {
      if (this.syncing) return;
      this.syncing = true;
      this.lastSyncError = null;
      try {
        const rows = await listSavedViews("dashboard-layout");
        const mine = rows.find((r) => r.is_owner && r.name === "default");
        if (mine) {
          const q = mine.query as { order?: string[]; hidden?: string[] };
          this.layout = {
            order: q.order ?? [],
            hidden: q.hidden ?? [],
          };
          this.serverId = mine.id;
        }
      } catch (e) {
        this.lastSyncError = layoutErrMsg(e);
      } finally {
        this.syncing = false;
      }
    },

    /** Resolve tile ordering against the canonical default list. Returns
     * the visible tile-id sequence. New tiles (not present in the saved
     * order) append to the end so adding tiles in a release doesn't hide
     * them from existing users.
     */
    resolveOrder(canonicalIds: string[]): string[] {
      const saved = this.layout.order;
      const hiddenSet = new Set(this.layout.hidden);
      if (saved.length === 0) {
        return canonicalIds.filter((id) => !hiddenSet.has(id));
      }
      const known = new Set(canonicalIds);
      const out: string[] = [];
      for (const id of saved) {
        if (known.has(id) && !hiddenSet.has(id)) out.push(id);
      }
      // Append any canonical tiles not in the saved order.
      for (const id of canonicalIds) {
        if (!saved.includes(id) && !hiddenSet.has(id)) out.push(id);
      }
      return out;
    },

    /** Persist the current layout. Creates a SavedView on first save. */
    async persist(layout: DashboardLayout): Promise<void> {
      this.layout = { ...layout };
      try {
        if (this.serverId == null) {
          const created = await createSavedView({
            kind: "dashboard-layout",
            name: "default",
            query: layout as unknown as Record<string, unknown>,
          });
          this.serverId = created.id;
        } else {
          await updateSavedView(this.serverId, {
            query: layout as unknown as Record<string, unknown>,
          });
        }
      } catch (e) {
        this.lastSyncError = layoutErrMsg(e, "save-failed");
      }
    },

    move(id: string, delta: number, canonicalIds: string[]): void {
      const visible = this.resolveOrder(canonicalIds);
      const idx = visible.indexOf(id);
      if (idx < 0) return;
      const j = idx + delta;
      if (j < 0 || j >= visible.length) return;
      [visible[idx], visible[j]] = [visible[j], visible[idx]];
      // Persist by combining with hidden set.
      const newOrder = visible.concat(
        canonicalIds.filter((c) => this.layout.hidden.includes(c)),
      );
      this.persist({ order: newOrder, hidden: this.layout.hidden });
    },

    toggleHidden(id: string, canonicalIds: string[]): void {
      const set = new Set(this.layout.hidden);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const order = this.layout.order.length
        ? this.layout.order
        : canonicalIds.slice();
      this.persist({ order, hidden: Array.from(set) });
    },

    reset(): void {
      this.persist({ order: [], hidden: [] });
    },
  },
});
