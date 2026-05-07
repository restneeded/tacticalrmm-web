<template>
  <div class="software-inventory-page q-pa-xl">
    <!-- ─── HEADER ─────────────────────────────────────────────── -->
    <div class="page-header">
      <h1 class="page-header__title">Software Inventory</h1>
      <p class="page-header__subtitle">
        Every distinct application detected across the fleet, ranked by
        prevalence. Phase E will add catalog matching and one-click takeover;
        Phase D establishes the data foundation.
      </p>
    </div>

    <!-- ─── SUMMARY TILE ───────────────────────────────────────── -->
    <q-card flat bordered class="summary-tile q-mt-lg">
      <q-card-section v-if="summaryLoading" class="summary-tile__loading">
        <q-spinner-dots size="24px" />
        <span class="q-ml-sm text-caption">Loading inventory summary…</span>
      </q-card-section>

      <q-card-section v-else-if="summaryError" class="summary-tile__error">
        Couldn't load summary: {{ summaryError }}
      </q-card-section>

      <q-card-section v-else class="summary-tile__body">
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ summary?.distinct_apps ?? 0 }}</div>
          <div class="summary-tile__label">distinct apps detected</div>
        </div>
        <div class="summary-tile__divider" aria-hidden="true" />
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ summary?.agents_with_inventory ?? 0 }}</div>
          <div class="summary-tile__label">agents reporting</div>
        </div>
        <div class="summary-tile__divider" aria-hidden="true" />
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ summary?.managed_apps ?? 0 }}</div>
          <div class="summary-tile__label">managed (Phase E)</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- ─── TABLE ──────────────────────────────────────────────── -->
    <q-card flat bordered class="apps-table q-mt-lg">
      <q-card-section class="apps-table__header">
        <div class="apps-table__title-row">
          <h2 class="apps-table__title">All apps</h2>
          <q-input
            v-model="search"
            dense
            outlined
            debounce="300"
            placeholder="Search by app or publisher…"
            class="apps-table__search"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </div>
      </q-card-section>

      <q-table
        :rows="rows"
        :columns="columns"
        row-key="id"
        flat
        bordered
        :loading="listLoading"
        :pagination="pagination"
        @update:pagination="onPagination"
        :rows-per-page-options="[25, 50, 100]"
        class="apps-table__q"
        no-data-label="No apps in inventory yet."
      >
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="cell-app">
              <div class="cell-app__name">{{ props.row.name }}</div>
              <div v-if="props.row.publisher" class="cell-app__pub">
                {{ props.row.publisher }}
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-versions="props">
          <q-td :props="props">
            <span class="versions">
              {{ props.row.version_count_distinct }}
              <span class="versions__hint">
                ({{ props.row.oldest_seen_version }}
                <template v-if="props.row.oldest_seen_version !== props.row.latest_seen_version">
                  → {{ props.row.latest_seen_version }}
                </template>)
              </span>
            </span>
          </q-td>
        </template>

        <template #body-cell-managed="props">
          <q-td :props="props">
            <q-badge
              :class="props.row.is_managed ? 'badge-managed' : 'badge-unmanaged'"
              :label="props.row.is_managed ? 'Managed' : 'Unmanaged'"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import {
  getInventorySummary,
  listInstalledApps,
  type InstalledAppListRow,
  type InventorySummary,
} from "@/api/software";

const summary = ref<InventorySummary | null>(null);
const summaryLoading = ref(true);
const summaryError = ref<string | null>(null);

const rows = ref<InstalledAppListRow[]>([]);
const listLoading = ref(false);
const search = ref("");

interface Pagination {
  page: number;
  rowsPerPage: number;
  rowsNumber: number;
  sortBy?: string;
  descending?: boolean;
}

const pagination = ref<Pagination>({
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
  sortBy: "installation_count",
  descending: true,
});

const columns = [
  { name: "name", label: "App", field: "name", align: "left" as const, sortable: true },
  {
    name: "installs",
    label: "Installs",
    field: "installation_count",
    align: "right" as const,
    sortable: true,
  },
  { name: "versions", label: "Versions", field: "version_count_distinct", align: "left" as const },
  { name: "managed", label: "Status", field: "is_managed", align: "left" as const },
];

async function loadSummary() {
  try {
    summaryLoading.value = true;
    summaryError.value = null;
    summary.value = await getInventorySummary();
  } catch (e) {
    summaryError.value = (e as Error).message ?? String(e);
  } finally {
    summaryLoading.value = false;
  }
}

async function loadList() {
  try {
    listLoading.value = true;
    const ordering = pagination.value.sortBy
      ? (pagination.value.descending ? "-" : "") + apiSortField(pagination.value.sortBy)
      : "-installation_count";
    const r = await listInstalledApps({
      page: pagination.value.page,
      page_size: pagination.value.rowsPerPage,
      ordering,
      search: search.value || undefined,
    });
    rows.value = r.results;
    pagination.value = { ...pagination.value, rowsNumber: r.count };
  } finally {
    listLoading.value = false;
  }
}

function apiSortField(uiField: string): string {
  // q-table sortBy uses the column 'name' value; map to API field name.
  if (uiField === "installs") return "installation_count";
  if (uiField === "name") return "name";
  return "installation_count";
}

function onPagination(p: Pagination) {
  pagination.value = p;
  loadList();
}

watch(search, () => {
  pagination.value.page = 1;
  loadList();
});

onMounted(() => {
  loadSummary();
  loadList();
});
</script>

<style lang="scss" scoped>
.software-inventory-page {
  max-width: 1400px;
  margin: 0 auto;
  color: var(--color-fg-primary);
}

.page-header {
  &__title {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
    line-height: 1.2;
  }
  &__subtitle {
    color: var(--color-fg-secondary);
    margin: var(--intune-space-s) 0 0;
    max-width: 720px;
    line-height: var(--intune-line-height-400);
  }
}

.summary-tile {
  background-color: var(--color-bg-surface);
  border-color: var(--color-stroke-divider);
  border-radius: var(--intune-radius-large);

  &__loading,
  &__error {
    color: var(--color-fg-secondary);
  }
  &__error { color: var(--intune-status-danger); }

  &__body {
    display: flex;
    align-items: center;
    gap: var(--intune-space-xxl);
    padding: var(--intune-space-xl) var(--intune-space-xxl);
  }
  &__big {
    display: flex;
    flex-direction: column;
  }
  &__number {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1;
    color: var(--color-fg-primary);
  }
  &__label {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin-top: var(--intune-space-xs);
  }
  &__divider {
    width: 1px;
    align-self: stretch;
    background-color: var(--color-stroke-divider);
  }
}

.apps-table {
  background-color: var(--color-bg-surface);
  border-color: var(--color-stroke-divider);
  border-radius: var(--intune-radius-large);

  &__header { padding-bottom: 0; }
  &__title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--intune-space-l);
  }
  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
  }
  &__search { min-width: 280px; }
  &__q {
    background-color: transparent;
    :deep(thead th) {
      color: var(--color-fg-tertiary);
      font-weight: var(--intune-font-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-size: var(--intune-font-size-200);
    }
  }
}

.cell-app {
  &__name {
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-primary);
  }
  &__pub {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    margin-top: 2px;
  }
}

.versions {
  &__hint {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    margin-left: var(--intune-space-xs);
  }
}

.badge-unmanaged {
  background-color: var(--color-bg-surface-2);
  color: var(--color-fg-secondary);
  border: 1px solid var(--color-stroke-divider);
}
.badge-managed {
  background-color: var(--color-brand-bg-rest);
  color: var(--color-brand-rest);
  border: 1px solid var(--color-brand-rest);
}
</style>
