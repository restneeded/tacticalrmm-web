// Phase S — current-user permission cache.
//
// Loaded once (lazily on first call to `ensure()`); after that, the AppShell
// sidebar reads the `can_list_*` flags synchronously to gate the
// Administration nav group. The endpoint is authenticated-only, so this
// works for every signed-in user — even ones who can't manage anything.

import { defineStore } from "pinia";
import axios from "axios";

interface CurrentUserPerms {
  is_superuser: boolean;
  can_list_accounts: boolean;
  can_list_roles: boolean;
  can_list_api_keys: boolean;
}

const ZERO: CurrentUserPerms = {
  is_superuser: false,
  can_list_accounts: false,
  can_list_roles: false,
  can_list_api_keys: false,
};

export const useCurrentUserPermsStore = defineStore("currentUserPerms", {
  state: () => ({
    perms: { ...ZERO } as CurrentUserPerms,
    loaded: false,
    loading: false,
  }),

  getters: {
    canSeeAdminNav(state): boolean {
      return (
        state.perms.is_superuser ||
        state.perms.can_list_accounts ||
        state.perms.can_list_roles ||
        state.perms.can_list_api_keys
      );
    },
  },

  actions: {
    async ensure(): Promise<void> {
      if (this.loaded || this.loading) return;
      this.loading = true;
      try {
        const { data } = await axios.get<CurrentUserPerms>(
          "/accounts/permissions/",
        );
        this.perms = data;
        this.loaded = true;
      } catch (e) {
        // Soft-fail: leave perms zeroed; the nav group simply won't render.
        // eslint-disable-next-line no-console
        console.error("[permissions] load failed:", e);
      } finally {
        this.loading = false;
      }
    },

    /** Force a re-fetch (call after the user's role changes). */
    async reload(): Promise<void> {
      this.loaded = false;
      await this.ensure();
    },
  },
});
