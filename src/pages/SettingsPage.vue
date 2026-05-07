<!--
  Phase G — Settings page.
  Today this owns the dashboard layout customizer. Future work (tenant
  settings, integrations, alert policies, etc.) lands here as new
  sections without disturbing this layout.
-->
<template>
  <q-page class="settings">
    <header class="settings__hero">
      <h1 class="settings__title">Settings</h1>
      <p class="settings__lede">
        Personalise your dashboard, manage saved views, and tweak account-level preferences.
      </p>
    </header>

    <section class="settings__section">
      <h2 class="settings__section-title">Dashboard layout</h2>
      <p class="settings__section-lede">
        Choose which tiles show on your home dashboard and the order they appear.
        Other team members see their own layouts.
      </p>

      <div v-if="layout.lastSyncError" class="settings__error">
        Sync error: {{ layout.lastSyncError }}
      </div>

      <ul class="settings__tile-list" role="list">
        <li
          v-for="(tile, idx) in resolved"
          :key="tile.id"
          class="settings__tile-row"
        >
          <span class="settings__tile-label">
            <q-icon :name="tile.icon" size="20px" class="settings__tile-icon" />
            {{ tile.name }}
            <span class="settings__tile-id">{{ tile.id }}</span>
          </span>
          <div class="settings__tile-actions">
            <q-btn
              flat dense round size="sm" icon="arrow_upward"
              :disable="idx === 0"
              :aria-label="`Move ${tile.name} up`"
              @click="layout.move(tile.id, -1, canonicalIds)"
            />
            <q-btn
              flat dense round size="sm" icon="arrow_downward"
              :disable="idx === resolved.length - 1"
              :aria-label="`Move ${tile.name} down`"
              @click="layout.move(tile.id, +1, canonicalIds)"
            />
            <q-btn
              flat dense no-caps size="sm"
              icon="visibility_off"
              label="Hide"
              :aria-label="`Hide ${tile.name} on dashboard`"
              @click="layout.toggleHidden(tile.id, canonicalIds)"
            />
          </div>
        </li>
      </ul>

      <details v-if="hidden.length > 0" class="settings__hidden">
        <summary>Hidden tiles ({{ hidden.length }})</summary>
        <ul class="settings__tile-list" role="list">
          <li
            v-for="tile in hidden"
            :key="tile.id"
            class="settings__tile-row settings__tile-row--hidden"
          >
            <span class="settings__tile-label">
              <q-icon :name="tile.icon" size="20px" class="settings__tile-icon" />
              {{ tile.name }}
              <span class="settings__tile-id">{{ tile.id }}</span>
            </span>
            <q-btn
              flat dense no-caps size="sm" icon="visibility" label="Show"
              :aria-label="`Show ${tile.name} on dashboard`"
              @click="layout.toggleHidden(tile.id, canonicalIds)"
            />
          </li>
        </ul>
      </details>

      <div class="settings__footer">
        <q-btn flat no-caps label="Reset to default" @click="layout.reset()" />
        <span v-if="layout.syncing" class="settings__syncing">
          <q-spinner-dots size="14px" /> Syncing…
        </span>
      </div>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

import { CANONICAL_TILES } from "@/views/dashboardTiles";
import { useDashboardLayoutStore } from "@/stores/dashboardLayout";

const layout = useDashboardLayoutStore();
const canonicalIds = CANONICAL_TILES.map((t) => t.id);

onMounted(() => layout.syncFromServer());

const resolved = computed(() =>
  layout.resolveOrder(canonicalIds).map(
    (id) => CANONICAL_TILES.find((t) => t.id === id)!,
  ),
);
const hidden = computed(() =>
  layout.layout.hidden
    .map((id) => CANONICAL_TILES.find((t) => t.id === id))
    .filter(Boolean) as typeof CANONICAL_TILES,
);
</script>

<style lang="scss" scoped>
.settings {
  padding: 28px 32px 64px;
  max-width: 920px;
  margin: 0 auto;
  &__hero { margin-bottom: 24px; }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 4px 0;
    color: var(--color-fg-primary);
  }
  &__lede {
    color: var(--color-fg-secondary);
    margin: 0;
  }
  &__section {
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 20px 24px;
    box-shadow: var(--intune-shadow-1);
  }
  &__section-title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 4px 0;
    color: var(--color-fg-primary);
  }
  &__section-lede {
    color: var(--color-fg-secondary);
    margin: 0 0 16px 0;
  }
  &__error {
    background-color: var(--color-bg-danger-subtle, rgba(197, 15, 31, 0.08));
    color: var(--intune-color-danger-600, #c50f1f);
    padding: 8px 12px;
    border-radius: var(--intune-radius-medium);
    margin-bottom: 12px;
  }
  &__tile-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  &__tile-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background-color: var(--color-bg-canvas);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);

    &--hidden {
      opacity: 0.7;
    }
  }
  &__tile-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-primary);
  }
  &__tile-icon {
    color: var(--color-accent-500);
  }
  &__tile-id {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-100);
    font-family: var(--intune-font-family-mono, ui-monospace, monospace);
  }
  &__tile-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  &__hidden {
    margin-top: 14px;
    summary {
      cursor: pointer;
      color: var(--color-fg-secondary);
      margin-bottom: 8px;
      &:focus-visible { outline: 2px solid var(--color-accent-500); }
    }
  }
  &__footer {
    margin-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  &__syncing {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
  }
}
</style>
