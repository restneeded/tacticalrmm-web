// Pinia theme store — Phase A
// Owns the user's theme choice (light / dark / system), persists it to
// localStorage, watches the OS color scheme, and applies the result by
// (a) toggling Quasar's Dark plugin, and (b) setting [data-theme="dark"]
// on the <html> element so our CSS custom properties switch instantly.

import { defineStore } from "pinia";
import { Dark } from "quasar";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "trmm:theme";

function getSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch (_e) {
    /* ignore — private mode, ssr, etc. */
  }
  return "system";
}

export const useThemeStore = defineStore("theme", {
  state: () => ({
    mode: readStoredMode() as ThemeMode,
    systemPrefersDark: getSystemDark(),
    _mediaQuery: null as MediaQueryList | null,
  }),

  getters: {
    resolved(state): "light" | "dark" {
      if (state.mode === "system")
        return state.systemPrefersDark ? "dark" : "light";
      return state.mode;
    },
  },

  actions: {
    setMode(mode: ThemeMode) {
      this.mode = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (_e) {
        /* ignore */
      }
      this.applyResolved();
    },

    cycle() {
      const next: Record<ThemeMode, ThemeMode> = {
        light: "dark",
        dark: "system",
        system: "light",
      };
      this.setMode(next[this.mode]);
    },

    applyResolved() {
      const dark = this.resolved === "dark";

      // 1. Quasar's Dark plugin — drives any Quasar component that respects it.
      Dark.set(dark);

      // 2. <html data-theme="..."> — drives our CSS custom properties.
      if (typeof document !== "undefined") {
        const html = document.documentElement;
        // brief transition class for a tasteful color flip
        html.classList.add("theme-transitioning");
        if (dark) html.setAttribute("data-theme", "dark");
        else html.removeAttribute("data-theme");
        window.setTimeout(() => {
          html.classList.remove("theme-transitioning");
        }, 250);
      }
    },

    init() {
      if (typeof window === "undefined") return;

      // Watch system preference so "system" mode tracks live changes.
      if (window.matchMedia) {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        this._mediaQuery = mq;
        const onChange = (e: MediaQueryListEvent) => {
          this.systemPrefersDark = e.matches;
          if (this.mode === "system") this.applyResolved();
        };
        // Modern browsers use addEventListener; the legacy mq.addListener API is
        // typed only in older lib.dom.d.ts revisions, so we narrow via a typed cast.
        type LegacyMQL = MediaQueryList & {
          addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
        };
        const legacy = mq as LegacyMQL;
        if (legacy.addEventListener) legacy.addEventListener("change", onChange);
        else if (legacy.addListener) legacy.addListener(onChange);
      }

      this.applyResolved();
    },
  },
});
