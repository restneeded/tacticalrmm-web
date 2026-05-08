<!--
  Phase T2 — Dashboard tiles section.
  Extracted from the Phase G SettingsPage stub. Logic is unchanged; only
  the wrapping chrome moves into the shared SettingsCard.
-->
<template>
  <SettingsCard
    title="Dashboard tiles"
    lede="Choose which tiles show on your home dashboard and the order they
          appear. Other team members see their own layouts."
  >
    <div v-if="layout.lastSyncError" class="dts__error">
      Sync error: {{ layout.lastSyncError }}
    </div>

    <ul class="dts__list" role="list">
      <li
        v-for="(tile, idx) in resolved"
        :key="tile.id"
        class="dts__row"
      >
        <span class="dts__label">
          <q-icon :name="tile.icon" size="20px" class="dts__icon" />
          {{ tile.name }}
          <span class="dts__id">{{ tile.id }}</span>
        </span>
        <div class="dts__actions">
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

    <details v-if="hidden.length > 0" class="dts__hidden">
      <summary>Hidden tiles ({{ hidden.length }})</summary>
      <ul class="dts__list" role="list">
        <li
          v-for="tile in hidden"
          :key="tile.id"
          class="dts__row dts__row--hidden"
        >
          <span class="dts__label">
            <q-icon :name="tile.icon" size="20px" class="dts__icon" />
            {{ tile.name }}
            <span class="dts__id">{{ tile.id }}</span>
          </span>
          <q-btn
            flat dense no-caps size="sm" icon="visibility" label="Show"
            :aria-label="`Show ${tile.name} on dashboard`"
            @click="layout.toggleHidden(tile.id, canonicalIds)"
          />
        </li>
      </ul>
    </details>

    <template #footer>
      <q-btn flat no-caps label="Reset to default" @click="layout.reset()" />
      <span v-if="layout.syncing" class="dts__syncing">
        <q-spinner-dots size="14px" /> Syncing…
      </span>
    </template>
  </SettingsCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

import SettingsCard from "@/components/settings/SettingsCard.vue";
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
.dts {
  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background-color: var(--color-bg-canvas);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);

    &--hidden { opacity: 0.7; }
  }
  &__label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-primary);
  }
  &__icon { color: var(--color-accent-500); }
  &__id {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-100);
    font-family: var(--intune-font-family-mono, ui-monospace, monospace);
  }
  &__actions { display: flex; align-items: center; gap: 4px; }
  &__hidden { margin-top: 14px; }
  &__error {
    background-color: var(--color-bg-danger-subtle, rgba(197, 15, 31, 0.08));
    color: var(--intune-color-danger-600, #c50f1f);
    padding: 8px 12px;
    border-radius: var(--intune-radius-medium);
    margin-bottom: 4px;
  }
  &__syncing {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-100);
  }
}
</style>
