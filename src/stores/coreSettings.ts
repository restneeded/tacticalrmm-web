// Phase T2 — CoreSettings store.
//
// Single global object — backed by /core/settings/ (GET full,  PUT full).
// Sections do partial saves via `save(patch)`: we merge over the cached
// payload and PUT the whole thing back, matching the legacy modal's
// pattern (the API view does NOT pass `partial=True` to its serializer).

import { defineStore } from "pinia";

import { fetchCoreSettings, editCoreSettings } from "@/api/core";
import type { CoreSetting } from "@/types/core/settings";

export const useCoreSettingsStore = defineStore("coreSettings", {
  state: () => ({
    settings: null as CoreSetting | null,
    loading: false,
    saving: false,
    error: null as string | null,
  }),

  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        this.settings = await fetchCoreSettings();
      } catch (e) {
        this.error = (e as { message?: string }).message ?? "load-failed";
      } finally {
        this.loading = false;
      }
    },

    async save(patch: Partial<CoreSetting>): Promise<void> {
      if (!this.settings) await this.load();
      if (!this.settings) throw new Error("CoreSettings not loaded");
      this.saving = true;
      try {
        const merged = { ...this.settings, ...patch } as CoreSetting;
        await editCoreSettings(merged);
        // Round-trip — serializer may massage values (HOSTED branch
        // overrides mesh fields, etc.).
        await this.load();
      } finally {
        this.saving = false;
      }
    },
  },
});
