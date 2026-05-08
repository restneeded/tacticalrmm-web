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
        </div>

        <q-space />

        <!-- Phase T1: global search (agents + clients + sites) -->
        <TopBarSearch />

        <q-space />

        <!-- Phase T1: notifications panel — badge + top-5 unresolved alerts -->
        <TopBarNotifications />

        <!-- Phase T1: account menu — username/role, theme, sign out -->
        <TopBarAccountMenu />
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
          <!-- phase-s-nav-gate -->
          <template v-for="group in visibleNavGroups" :key="group.label">
            <div v-if="!miniSidebar" class="app-shell__nav-group-label">
              {{ group.label }}
            </div>
            <q-item
              v-for="item in visibleItems(group)"
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
              <q-item-section v-if="!miniSidebar && item.badgeKey === 'alertCount' && alertCount > 0" side>
                <q-badge color="negative" :label="alertCount" />
              </q-item-section>
              <q-item-section v-if="!miniSidebar && item.badgeKey === 'pendingCount' && pendingCount > 0" side>
                <q-badge color="primary" :label="pendingCount" />
              </q-item-section>
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
import { ref, computed, onMounted } from "vue";
import { useAlertCount }  from "@/composables/useAlertCount";
import { usePendingCount } from "@/composables/usePendingCount";
import { useCurrentUserPermsStore } from "@/stores/permissions";
import TopBarSearch from "@/components/topbar/TopBarSearch.vue";
import TopBarNotifications from "@/components/topbar/TopBarNotifications.vue";
import TopBarAccountMenu from "@/components/topbar/TopBarAccountMenu.vue";

const { count: alertCount }   = useAlertCount();
const { count: pendingCount } = usePendingCount();

const leftDrawerOpen = ref(true);
const miniSidebar = ref(false);

// Sidebar groups — modern AppShell navigation.

const permsStore = useCurrentUserPermsStore();
onMounted(() => {
  void permsStore.ensure();
});

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
      { to: "/policies", label: "Policies", icon: "policy" },
      { to: "/alerts",   label: "Alerts",   icon: "notifications_active", badgeKey: "alertCount" },
      { to: "/software", label: "Software", icon: "apps" },
      { to: "/patching", label: "Patching", icon: "system_update" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/audit",       label: "Audit",       icon: "fact_check" },
      { to: "/pending",     label: "Pending",     icon: "hourglass_top",   badgeKey: "pendingCount" },
      { to: "/diagnostics", label: "Diagnostics", icon: "monitor_heart" },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", label: "Reports", icon: "insights" }],
  },
  {
    label: "Administration",
    visibleKey: "canSeeAdminNav",
    items: [
      { to: "/users",    label: "Users",    icon: "people",       permKey: "can_list_accounts" },
      { to: "/roles",    label: "Roles",    icon: "admin_panel_settings", permKey: "can_list_roles" },
      { to: "/api-keys", label: "API keys", icon: "vpn_key",      permKey: "can_list_api_keys" },
      // Phase T6 — internal honesty page; superuser-only via is_superuser permKey.
      { to: "/migration-status", label: "Migration status", icon: "swap_horiz", permKey: "is_superuser" },
    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];


// Phase S — gate Administration nav group + per-item visibility on
// the current user's perms. Items without permKey are always visible.
const visibleNavGroups = computed(() => {
  return navGroups.filter((g) => {
    if (!g.visibleKey) return true;
    if (g.visibleKey === "canSeeAdminNav") return permsStore.canSeeAdminNav;
    return true;
  });
});
function visibleItems(group) {
  return group.items.filter((item) => {
    if (!item.permKey) return true;
    return !!permsStore.perms[item.permKey];
  });
}
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
