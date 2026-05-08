<!--
  Phase I — FilterBar for the Clients & Sites table.
  Same skinning conventions as the /devices FilterBar, but the chips and
  saved-view kind are Phase-I-specific.
-->
<template>
  <div class="csfb">
    <!-- Row 1: search + saved views + group toggle + density + columns -->
    <div class="csfb__row csfb__row--main">
      <q-input
        v-model="search"
        outlined
        dense
        debounce="120"
        placeholder="Search client or site…"
        class="csfb__search"
      >
        <template v-slot:prepend><q-icon name="search" /></template>
        <template v-slot:append>
          <q-icon
            v-if="search"
            name="close"
            class="cursor-pointer"
            @click="search = ''"
          />
        </template>
      </q-input>

      <ClientsSitesSavedViewsMenu @apply="applyView" />

      <q-toggle
        v-model="groupByClient"
        label="Group by Client"
        class="csfb__group-toggle"
        size="sm"
      />

      <q-btn-toggle
        v-model="density"
        flat
        toggle-color="primary"
        :options="densityOptions"
        size="sm"
        class="csfb__density"
      />

      <q-btn flat dense icon="view_column" class="csfb__cols-btn">
        <q-tooltip>Columns</q-tooltip>
        <q-menu anchor="bottom right" self="top right">
          <q-list dense style="min-width: 220px;">
            <q-item-label header>Visible columns</q-item-label>
            <q-item
              v-for="c in allColumns"
              :key="c.name"
              tag="label"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-checkbox
                  :model-value="visibleColumns.includes(c.name)"
                  @update:model-value="toggleColumn(c.name)"
                  :disable="c.required === true"
                />
              </q-item-section>
              <q-item-section>{{ c.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- Row 2: filter chips -->
    <div class="csfb__row csfb__row--chips">
      <ChipSelect
        label="Client"
        icon="business"
        v-model="filters.client"
        :options="clientOptions"
        nullable
      />

      <q-chip
        :selected="filters.failingChecks"
        clickable
        icon="error"
        outline
        size="md"
        @click="toggleBool('failingChecks')"
      >
        Failing checks
      </q-chip>
      <q-chip
        :selected="filters.emptySites"
        clickable
        icon="folder_off"
        outline
        size="md"
        @click="toggleBool('emptySites')"
      >
        No agents
      </q-chip>
      <q-chip
        :selected="filters.hasAgents"
        clickable
        icon="group"
        outline
        size="md"
        @click="toggleBool('hasAgents')"
      >
        Has agents
      </q-chip>
      <q-chip
        :selected="filters.hasWorkstations"
        clickable
        icon="computer"
        outline
        size="md"
        @click="toggleBool('hasWorkstations')"
      >
        Has workstations
      </q-chip>
      <q-chip
        :selected="filters.hasServers"
        clickable
        icon="dns"
        outline
        size="md"
        @click="toggleBool('hasServers')"
      >
        Has servers
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

import {
  useClientsSitesStore,
  DEFAULT_FILTERS,
  type FilterState,
} from "@/stores/clientsSites";
import type { ClientsSitesView } from "@/stores/clientsSitesView";
import { TABLE_COLUMNS } from "@/components/clientsSites/columns";

import ChipSelect from "@/components/devices/ChipSelect.vue";
import ClientsSitesSavedViewsMenu from "@/components/clientsSites/ClientsSitesSavedViewsMenu.vue";

const store = useClientsSitesStore();
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
  { value: "comfortable", icon: "density_large" },
  { value: "cozy",        icon: "density_medium" },
  { value: "compact",     icon: "density_small"  },
];

const groupByClient = computed({
  get: () => store.groupByClient,
  set: (v: boolean) => (store.groupByClient = v),
});

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

function applyView(v: ClientsSitesView) {
  store.filters = { ...v.filters };
  store.sort = { ...v.sort };
  store.visibleColumns = [...v.visibleColumns];
  store.density = v.density;
  store.groupByClient = v.groupByClient;
  store.page = 1;
}
</script>

<style lang="scss" scoped>
.csfb {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;

  &__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  &__row--chips { gap: 6px; }
  &__search {
    flex: 1 1 320px;
    min-width: 280px;
    max-width: 480px;
    :deep(.q-field__control) { background: var(--color-bg-surface); }
  }
  &__group-toggle :deep(.q-toggle__label) { font-size: var(--intune-font-size-200); }
  &__density,
  &__cols-btn {
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
  }
}
</style>
