<!--
  DevicesFilterBar — search box, filter chips, density, columns, saved views.
  All state lives in the devices store; this component only reads + dispatches.
-->
<template>
  <div class="dfb">
    <!-- Row 1: search + saved views + density + columns -->
    <div class="dfb__row dfb__row--main">
      <q-input
        v-model="search"
        outlined
        dense
        debounce="120"
        placeholder="Search hostname, client, site, OS, user, IP…"
        class="dfb__search"
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
        <template v-slot:append>
          <q-icon
            v-if="search"
            name="close"
            class="cursor-pointer"
            @click="search = ''"
          />
        </template>
      </q-input>

      <SavedViewsMenu @apply="applyView" />

      <q-btn-toggle
        v-model="density"
        flat
        toggle-color="primary"
        :options="densityOptions"
        size="sm"
        class="dfb__density"
      />

      <q-btn flat dense icon="view_column" class="dfb__cols-btn">
        <q-tooltip>Columns</q-tooltip>
        <q-menu anchor="bottom right" self="top right">
          <q-list dense style="min-width: 220px;">
            <q-item-label header>Visible columns</q-item-label>
            <q-item v-for="c in allColumns" :key="c.name" tag="label" clickable v-ripple>
              <q-item-section avatar>
                <q-checkbox
                  :model-value="visibleColumns.includes(c.name)"
                  @update:model-value="toggleColumn(c.name)"
                />
              </q-item-section>
              <q-item-section>{{ c.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- Row 2: filter chips -->
    <div class="dfb__row dfb__row--chips">
      <ChipSelect
        label="Type"
        icon="computer"
        v-model="filters.monType"
        :options="[
          { label: 'All', value: 'all' },
          { label: 'Servers', value: 'server' },
          { label: 'Workstations', value: 'workstation' },
        ]"
      />
      <ChipSelect
        label="Status"
        icon="signal_cellular_alt"
        v-model="filters.status"
        :options="[
          { label: 'All', value: 'all' },
          { label: 'Online', value: 'online' },
          { label: 'Offline', value: 'offline' },
          { label: 'Overdue', value: 'overdue' },
        ]"
      />
      <ChipSelect
        label="OS"
        icon="terminal"
        v-model="filters.osFamily"
        :options="osOptions"
      />
      <ChipSelect
        label="Client"
        icon="business"
        v-model="filters.client"
        :options="clientOptions"
        nullable
      />
      <ChipSelect
        label="Site"
        icon="place"
        v-model="filters.site"
        :options="siteOptions"
        nullable
      />

      <q-chip
        :selected="filters.hasFailingChecks"
        clickable
        @click="toggleBool('hasFailingChecks')"
        icon="error"
        color="negative"
        text-color="white"
        outline
        size="md"
      >
        Failing checks
      </q-chip>
      <q-chip
        :selected="filters.hasPatchesPending"
        clickable
        @click="toggleBool('hasPatchesPending')"
        icon="verified_user"
        color="warning"
        text-color="white"
        outline
        size="md"
      >
        Patches pending
      </q-chip>
      <q-chip
        :selected="filters.needsReboot"
        clickable
        @click="toggleBool('needsReboot')"
        icon="restart_alt"
        color="primary"
        outline
        size="md"
      >
        Reboot pending
      </q-chip>
      <q-chip
        :selected="filters.hasPendingActions"
        clickable
        @click="toggleBool('hasPendingActions')"
        icon="schedule"
        outline
        size="md"
      >
        Pending actions
      </q-chip>

      <q-btn
        v-if="anyFilterActive"
        flat
        dense
        size="sm"
        label="Clear filters"
        icon="filter_alt_off"
        @click="store.resetFilters"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useDevicesStore, DEFAULT_FILTERS, type FilterState } from "@/stores/devices";
import type { DevicesView } from "@/stores/devicesView";
import { TABLE_COLUMNS } from "@/components/devices/columns";

import ChipSelect from "@/components/devices/ChipSelect.vue";
import SavedViewsMenu from "@/components/devices/SavedViewsMenu.vue";

const store = useDevicesStore();
const filters = store.filters;

const search = computed({
  get: () => store.filters.search,
  set: (v: string) => store.setFilter("search", v),
});

const density = computed({
  get: () => store.density,
  set: (v) => (store.density = v),
});
const densityOptions = [
  { value: "comfortable", icon: "density_large", slot: "comfortable" },
  { value: "cozy",        icon: "density_medium", slot: "cozy" },
  { value: "compact",     icon: "density_small",  slot: "compact" },
].map((o) => ({ value: o.value, icon: o.icon }));

const visibleColumns = computed(() => store.visibleColumns);
const allColumns = TABLE_COLUMNS;
function toggleColumn(name: string) {
  const set = new Set(store.visibleColumns);
  if (set.has(name)) set.delete(name);
  else set.add(name);
  store.visibleColumns = [...set];
}

const clientOptions = computed(() =>
  store.clientOptions.map((c) => ({ label: c, value: c })),
);
const siteOptions = computed(() =>
  store.siteOptions.map((s) => ({ label: s, value: s })),
);
const osOptions = computed(() => [
  { label: "All", value: "all" },
  ...store.osFamilyOptions.map((o) => ({
    label: o[0].toUpperCase() + o.slice(1),
    value: o,
  })),
]);

function toggleBool(key: keyof FilterState) {
  const v = store.filters[key] as boolean;
  store.setFilter(key, !v as never);
}

const anyFilterActive = computed(() => {
  for (const k of Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]) {
    if (k === "search") continue;
    if (store.filters[k] !== DEFAULT_FILTERS[k]) return true;
  }
  return false;
});

function applyView(v: DevicesView) {
  store.filters = { ...v.filters };
  store.sort = { ...v.sort };
  store.visibleColumns = [...v.visibleColumns];
  store.density = v.density;
  store.page = 1;
}
</script>

<style lang="scss" scoped>
.dfb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  &__row--chips {
    gap: 6px;
  }
  &__search {
    flex: 1 1 320px;
    min-width: 280px;
    max-width: 480px;
    :deep(.q-field__control) {
      background: var(--color-bg-surface);
    }
  }
  &__density {
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
  }
  &__cols-btn {
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
  }
}
</style>
