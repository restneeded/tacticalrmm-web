<!--
  HomeView (Phase B) — card-based dashboard at the route "/".
  Tiles are listed in the `tiles` array below; every tile owns its own
  fetching / loading / error / empty state. A future "Customize dashboard"
  feature can persist a user-specific reordering of this array without
  reshuffling files. Each tile MUST render real data from an existing
  TRMM endpoint — never fake data. If an endpoint is missing, the tile
  is omitted, not invented.
-->
<template>
  <q-page class="dashboard">
    <header class="dashboard__hero">
      <div>
        <h1 class="dashboard__title">Dashboard</h1>
        <p class="dashboard__lede">
          Fleet posture at a glance. Live counts pull from the TRMM dashboard
          websocket; everything else refreshes on its own cadence.
        </p>
      </div>
      <span class="dashboard__last-update">
        Welcome back<span v-if="username">, {{ username }}</span>.
      </span>
    </header>

    <section
      class="dashboard__grid"
      role="list"
      aria-label="Dashboard tiles"
    >
      <div
        v-for="tile in tiles"
        :key="tile.id"
        class="dashboard__cell"
        :class="`dashboard__cell--${tile.size}`"
        role="listitem"
      >
        <component :is="tile.component" />
      </div>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

import { useAuthStore } from "@/stores/auth";
import { useDashboardLayoutStore } from "@/stores/dashboardLayout";
import { CANONICAL_TILES, type DashboardTile } from "@/views/dashboardTiles";

const auth = useAuthStore();
const username = computed(() => auth.username || "");

const layoutStore = useDashboardLayoutStore();
onMounted(() => layoutStore.syncFromServer());

const tiles = computed<DashboardTile[]>(() => {
  const ids = layoutStore.resolveOrder(CANONICAL_TILES.map((t) => t.id));
  return ids
    .map((id) => CANONICAL_TILES.find((t) => t.id === id))
    .filter(Boolean) as DashboardTile[];
});
</script>

<style lang="scss" scoped>
.dashboard {
  padding: 28px 32px 64px;
  max-width: 1440px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.1;
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0;
    max-width: 720px;
  }
  &__last-update {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    white-space: nowrap;
    margin-top: 4px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 16px;
  }
  &__cell {
    display: flex;
    > :deep(*) {
      width: 100%;
    }
  }

  // 12-col widths
  &__cell--wide   { grid-column: span 6; }
  &__cell--medium { grid-column: span 4; }

  // Tablet — collapse to 6-col grid
  @media (max-width: 1024px) {
    padding: 20px 24px 48px;
    &__grid {
      grid-template-columns: repeat(6, 1fr);
    }
    &__cell--wide   { grid-column: span 6; }
    &__cell--medium { grid-column: span 3; }
  }

  // Phone — single column
  @media (max-width: 600px) {
    padding: 16px 16px 40px;
    &__hero {
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    &__grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    &__cell--wide,
    &__cell--medium {
      grid-column: 1 / -1;
    }
  }
}
</style>
