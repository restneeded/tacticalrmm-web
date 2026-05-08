// Phase S — Users store.
// Light Pinia store; users list is small (admin-only), so we keep it
// simple: rows + loading + filter/sort state. Writes go through the api
// wrapper in @/api/accounts then trigger reload().

import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";

import {
  fetchUsers,
  saveUser,
  editUser,
  removeUser,
} from "@/api/accounts";

export interface UserRow {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  last_login: string | null;
  last_login_ip: string | null;
  role: number | null;
  block_dashboard_login: boolean;
  date_format: string | null;
  totp_key?: string | null; // not on list serializer; we only know via detail
  social_accounts?: Array<{ provider: string; display: string }>;
}

export interface UserFilterState {
  search: string;
  activeOnly: boolean;
}

const DEFAULT_FILTERS: UserFilterState = { search: "", activeOnly: false };

export const useUsersStore = defineStore("users", {
  state: () => ({
    rows: [] as UserRow[],
    loading: false,
    error: null as string | null,
    filters: { ...DEFAULT_FILTERS } as UserFilterState,
    sort: { by: "username", desc: false } as { by: string; desc: boolean },
    rowsPerPage: useStorage<number>("users:rowsPerPage", 50),
    page: 1,
  }),

  getters: {
    filteredRows(state): UserRow[] {
      const q = state.filters.search.trim().toLowerCase();
      const out = state.rows.filter((r) => {
        if (state.filters.activeOnly && !r.is_active) return false;
        if (!q) return true;
        return (
          r.username.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.first_name ?? "").toLowerCase().includes(q) ||
          (r.last_name ?? "").toLowerCase().includes(q)
        );
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
  },

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const data = await fetchUsers();
        this.rows = (data ?? []) as UserRow[];
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },

    async create(payload: Partial<UserRow> & { password: string }) {
      await saveUser(payload);
      await this.load();
    },

    async update(id: number, payload: Partial<UserRow>) {
      await editUser(id, payload);
      await this.load();
    },

    async remove(id: number) {
      await removeUser(id);
      await this.load();
    },

    setSort(by: string, desc: boolean) {
      this.sort = { by, desc };
    },
    setFilter<K extends keyof UserFilterState>(k: K, v: UserFilterState[K]) {
      this.filters[k] = v;
      this.page = 1;
    },
  },
});
