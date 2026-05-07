// Phase G — Pinia cache for /clients/ + /clients/sites/.
// The DeployDialog target picker (and any future picker) used to refetch on
// every open. With this store, an open within 60s of the last fetch reuses
// the in-memory list. The freshness timestamp is exposed so the picker
// surfaces "this list is N seconds old" to the admin.

import axios, { type AxiosRequestConfig } from "axios";
import { defineStore } from "pinia";

import { useAuthStore } from "@/stores/auth";

const TTL_MS = 60_000;

export interface CachedClient {
  id: number;
  name: string;
}
export interface CachedSite {
  id: number;
  name: string;
  client_name: string;
  client: number;
}

function authConfig(extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  const auth = useAuthStore();
  const token = auth.token as string | null;
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  };
}

interface State {
  clients: CachedClient[];
  sites: CachedSite[];
  fetchedAt: number;       // ms-since-epoch; 0 means never fetched
  inFlight: Promise<void> | null;
}

export const useClientsCacheStore = defineStore("clientsCache", {
  state: (): State => ({ clients: [], sites: [], fetchedAt: 0, inFlight: null }),

  getters: {
    isFresh(state): boolean {
      return state.fetchedAt > 0 && Date.now() - state.fetchedAt < TTL_MS;
    },
    ageSeconds(state): number {
      if (state.fetchedAt === 0) return -1;
      return Math.floor((Date.now() - state.fetchedAt) / 1000);
    },
  },

  actions: {
    /** Resolve when the cache has been populated within TTL. Multiple
     * concurrent callers de-dup onto the same in-flight promise. */
    async ensureFresh(): Promise<void> {
      if (this.isFresh) return;
      if (this.inFlight) return this.inFlight;
      this.inFlight = (async () => {
        try {
          const [clientsR, sitesR] = await Promise.all([
            axios.get<CachedClient[]>("/clients/", authConfig()),
            axios.get<CachedSite[]>("/clients/sites/", authConfig()),
          ]);
          this.clients = clientsR.data;
          this.sites = sitesR.data;
          this.fetchedAt = Date.now();
        } finally {
          this.inFlight = null;
        }
      })();
      return this.inFlight;
    },
    /** Force a refresh — used when the admin clicks "refresh" in the picker. */
    async refresh(): Promise<void> {
      this.fetchedAt = 0;
      return this.ensureFresh();
    },
    invalidate() {
      this.fetchedAt = 0;
    },
  },
});
