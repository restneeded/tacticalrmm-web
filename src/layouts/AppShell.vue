<template>
  <q-layout view="hHh LpR fFf" class="app-shell">
    <!-- ─── TOP BAR ─────────────────────────────────────────────── -->
    <q-header class="app-shell__topbar" bordered>
      <q-toolbar class="q-px-md">
        <q-btn
          flat
          round
          dense
          :icon="leftDrawerOpen ? 'menu_open' : 'menu'"
          aria-label="Toggle navigation"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <div class="app-shell__brand q-ml-sm">
          <q-icon name="shield" size="20px" class="app-shell__brand-mark" />
          <span class="app-shell__brand-text">Tactical RMM</span>
          <span class="app-shell__brand-tag">Phase&nbsp;A</span>
        </div>

        <q-space />

        <!-- search (placeholder for Phase B) -->
        <div class="app-shell__search">
          <q-icon name="search" size="16px" class="app-shell__search-icon" />
          <input
            v-model="searchQuery"
            class="app-shell__search-input"
            type="text"
            placeholder="Search agents, scripts, settings…"
            aria-label="Search"
          />
        </div>

        <q-space />

        <q-btn
          flat
          round
          dense
          :icon="themeIcon"
          aria-label="Toggle theme"
          @click="theme.cycle()"
        >
          <q-tooltip anchor="bottom middle" self="top middle">
            Theme: {{ theme.mode }}
          </q-tooltip>
        </q-btn>

        <q-btn flat round dense icon="notifications_none" aria-label="Notifications">
          <q-tooltip anchor="bottom middle" self="top middle">Notifications</q-tooltip>
        </q-btn>

        <q-btn flat round dense aria-label="Account">
          <q-avatar size="28px" color="primary" text-color="white">
            <span class="text-caption">R</span>
          </q-avatar>
          <q-tooltip anchor="bottom middle" self="top middle">Account</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- ─── SIDEBAR ─────────────────────────────────────────────── -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      :mini="miniSidebar"
      :width="248"
      :mini-width="56"
      :breakpoint="800"
      class="app-shell__sidebar"
      bordered
    >
      <div class="app-shell__sidebar-inner">
        <q-list class="app-shell__nav">
          <template v-for="group in navGroups" :key="group.label">
            <div v-if="!miniSidebar" class="app-shell__nav-group-label">
              {{ group.label }}
            </div>
            <q-item
              v-for="item in group.items"
              :key="item.to"
              v-ripple
              clickable
              :to="item.to"
              exact
              class="app-shell__nav-item"
              active-class="app-shell__nav-item--active"
            >
              <q-item-section avatar>
                <q-icon :name="item.icon" size="18px" />
              </q-item-section>
              <q-item-section v-if="!miniSidebar">{{ item.label }}</q-item-section>
              <q-tooltip
                v-if="miniSidebar"
                anchor="center right"
                self="center left"
                :offset="[8, 0]"
              >
                {{ item.label }}
              </q-tooltip>
            </q-item>
          </template>
        </q-list>

        <q-space />

        <q-item
          v-ripple
          clickable
          class="app-shell__nav-item app-shell__nav-collapse"
          @click="miniSidebar = !miniSidebar"
        >
          <q-item-section avatar>
            <q-icon
              :name="miniSidebar ? 'chevron_right' : 'chevron_left'"
              size="18px"
            />
          </q-item-section>
          <q-item-section v-if="!miniSidebar">Collapse</q-item-section>
        </q-item>
      </div>
    </q-drawer>

    <!-- ─── MAIN ────────────────────────────────────────────────── -->
    <q-page-container class="app-shell__main">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useThemeStore } from "@/stores/theme";

const theme = useThemeStore();

const leftDrawerOpen = ref(true);
const miniSidebar = ref(false);
const searchQuery = ref("");

const themeIcon = computed(() => {
  if (theme.mode === "light") return "light_mode";
  if (theme.mode === "dark") return "dark_mode";
  return "brightness_auto";
});

// Sidebar groups — Phase A scaffold. Phase B+ will add child pages and
// peel functionality out of /legacy DashboardView.vue.
const navGroups = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Home", icon: "home" }],
  },
  {
    label: "Manage",
    items: [
      { to: "/clients", label: "Clients & Sites", icon: "business" },
      { to: "/devices", label: "Devices", icon: "devices" },
      { to: "/checks", label: "Checks", icon: "checklist" },
      { to: "/scripts", label: "Scripts", icon: "code" },
      { to: "/tasks", label: "Tasks", icon: "schedule" },
      { to: "/software", label: "Software", icon: "apps" },
      { to: "/patching", label: "Patching", icon: "system_update" },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", label: "Reports", icon: "insights" }],
  },
  {
    label: "Configure",
    items: [
      { to: "/settings", label: "Settings", icon: "settings" },
      { to: "/legacy", label: "Legacy UI", icon: "history" },
    ],
  },
];
</script>

<style lang="scss">
// Component-scoped styling lives in this file. Tokens (colors, radii, etc)
// come from src/css/intune-tokens.scss via CSS custom properties.

.app-shell {
  background-color: var(--color-bg-canvas);
  color: var(--color-fg-primary);
  font-family: var(--intune-font-family);

  &__topbar {
    background-color: var(--color-bg-topbar);
    color: var(--color-fg-primary);
    border-bottom: 1px solid var(--color-stroke-divider);
    box-shadow: none;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--intune-space-s);
    font-weight: var(--intune-font-weight-semibold);
    font-size: var(--intune-font-size-400);
  }
  &__brand-mark { color: var(--color-brand-rest); }
  &__brand-text { letter-spacing: 0.1px; }
  &__brand-tag {
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-regular);
    color: var(--color-fg-tertiary);
    border: 1px solid var(--color-stroke-divider);
    padding: 2px 8px;
    border-radius: var(--intune-radius-circular);
    margin-left: var(--intune-space-s);
  }

  &__search {
    display: flex;
    align-items: center;
    gap: var(--intune-space-s);
    background-color: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 0 var(--intune-space-m);
    width: min(560px, 40vw);
    height: 32px;
    transition: border-color var(--intune-duration-fast) var(--intune-curve-easy-ease);

    &:focus-within {
      border-color: var(--color-stroke-focus);
      box-shadow: 0 0 0 1px var(--color-stroke-focus);
    }
  }
  &__search-icon { color: var(--color-fg-tertiary); }
  &__search-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg-primary);
    font-family: var(--intune-font-family);
    font-size: var(--intune-font-size-300);
    line-height: var(--intune-line-height-300);
    &::placeholder { color: var(--color-fg-tertiary); }
  }

  &__sidebar {
    background-color: var(--color-bg-sidebar);
    border-right: 1px solid var(--color-stroke-divider);

    .q-drawer__content { background-color: var(--color-bg-sidebar); }
  }

  // Phase D drive-by fix: Quasar passes the q-drawer's `class` prop down
  // to the inner .q-drawer__content div, NOT the outer <aside>. The aside
  // therefore kept Quasar's default white background regardless of theme,
  // which leaked through during the drawer's slide transition and at any
  // point the inner content didn't fully cover the aside (visible as
  // 'sidebar didn't flip'). Paint the aside via the same CSS variable so
  // both elements track light/dark together.
  aside.q-drawer {
    background-color: var(--color-bg-sidebar);
  }
  &__sidebar-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-top: var(--intune-space-s);
  }

  &__nav { flex: 1; padding: 0; }

  &__nav-group-label {
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-size: 11px;
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-tertiary);
    padding: var(--intune-space-l) var(--intune-space-l) var(--intune-space-xs);
  }

  &__nav-item {
    margin: 2px var(--intune-space-s);
    padding: 6px var(--intune-space-s);
    border-radius: var(--intune-radius-medium);
    color: var(--color-fg-secondary);
    min-height: 36px;

    .q-item__section--avatar { min-width: 24px; padding-right: 0; }
    .q-icon { color: var(--color-fg-tertiary); }

    &:hover {
      background-color: var(--color-bg-surface-2);
      color: var(--color-fg-primary);
      .q-icon { color: var(--color-fg-primary); }
    }

    &--active {
      background-color: var(--color-brand-bg-rest);
      color: var(--color-brand-rest);
      font-weight: var(--intune-font-weight-semibold);
      .q-icon { color: var(--color-brand-rest); }
    }
  }

  &__nav-collapse { color: var(--color-fg-tertiary); }

  &__main {
    background-color: var(--color-bg-canvas);
  }
}

// In dark mode, the sidebar is the deep navy rail (Intune signature).
// Active items use a brighter blue against the dark background.
[data-theme="dark"] .app-shell__sidebar {
  background-color: var(--color-bg-sidebar);
  .q-drawer__content { background-color: var(--color-bg-sidebar); }
}
[data-theme="dark"] .app-shell__nav-item {
  color: var(--intune-neutral-grey-78);
  .q-icon { color: var(--intune-neutral-grey-70); }
  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    .q-icon { color: #ffffff; }
  }
  &--active {
    background-color: rgba(0, 120, 212, 0.18);
    color: var(--intune-brand-100);
    .q-icon { color: var(--intune-brand-100); }
  }
}
[data-theme="dark"] .app-shell__nav-group-label {
  color: var(--intune-neutral-grey-60);
}
</style>
