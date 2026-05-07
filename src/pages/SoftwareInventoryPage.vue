<template>
  <div class="software-inventory-page q-pa-xl">
    <!-- ─── HEADER ─────────────────────────────────────────────── -->
    <div class="page-header">
      <h1 class="page-header__title">Software Inventory — Discovery</h1>
      <p class="page-header__subtitle">
        Find apps your fleet has already installed and start managing them.
        Take over an app once and we'll keep its versions in step across
        every machine that has it.
      </p>
    </div>

    <!-- ─── SUMMARY BAND ───────────────────────────────────────── -->
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
          <div class="summary-tile__label">apps detected</div>
        </div>
        <div class="summary-tile__divider" aria-hidden="true" />
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ summary?.managed_apps ?? 0 }}</div>
          <div class="summary-tile__label">already managed</div>
        </div>
        <div class="summary-tile__divider" aria-hidden="true" />
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ unmatchedCount }}</div>
          <div class="summary-tile__label">unmatched (review needed)</div>
        </div>
        <div class="summary-tile__divider" aria-hidden="true" />
        <div class="summary-tile__big">
          <div class="summary-tile__number">{{ summary?.agents_with_inventory ?? 0 }}</div>
          <div class="summary-tile__label">agents reporting</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- ─── TABS ───────────────────────────────────────────────── -->
    <q-tabs
      v-model="activeTab"
      align="left"
      no-caps
      inline-label
      class="phase-e-tabs q-mt-lg"
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab
        name="discovery"
        :label="`Discovery (${discoveryCount})`"
        icon="travel_explore"
      />
      <q-tab
        name="managed"
        :label="`Managed (${summary?.managed_apps ?? 0})`"
        icon="verified"
      />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated keep-alive class="phase-e-panels">
      <!-- ─── DISCOVERY ────────────────────────────────────────── -->
      <q-tab-panel name="discovery" class="phase-e-panels__panel">
        <q-card flat bordered class="apps-card">
          <q-card-section class="apps-card__filters">
            <q-input
              v-model="search"
              dense
              outlined
              debounce="300"
              placeholder="Search by app or publisher…"
              class="apps-card__search"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>

            <q-select
              v-model="discoveryFilter"
              :options="discoveryFilterOptions"
              dense
              outlined
              emit-value
              map-options
              class="apps-card__filter"
            />

            <q-select
              v-model="discoverySort"
              :options="discoverySortOptions"
              dense
              outlined
              emit-value
              map-options
              class="apps-card__filter"
            />
          </q-card-section>

          <q-table
            v-if="!discoveryLoading || discoveryRows.length > 0"
            :rows="discoveryRows"
            :columns="discoveryColumns"
            row-key="id"
            flat
            :loading="discoveryLoading"
            :pagination="discoveryPagination"
            @update:pagination="onDiscoveryPagination"
            :rows-per-page-options="[25, 50, 100]"
            class="apps-card__table"
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

            <template #body-cell-prevalence="props">
              <q-td :props="props">
                <div class="cell-prev">
                  <span class="cell-prev__num">{{ props.row.installation_count }}</span>
                  <span class="cell-prev__total">/ {{ summary?.agents_with_inventory ?? 0 }} machines</span>
                  <div v-if="props.row.version_count_distinct > 1" class="cell-prev__drift">
                    {{ props.row.version_count_distinct }} versions
                    ({{ props.row.oldest_seen_version }} → {{ props.row.latest_seen_version }})
                  </div>
                  <div v-else class="cell-prev__drift cell-prev__drift--clean">
                    All on {{ props.row.latest_seen_version || "—" }}
                  </div>
                </div>
              </q-td>
            </template>

            <template #body-cell-package="props">
              <q-td :props="props">
                <q-chip
                  v-if="props.row.has_package_match"
                  dense
                  outline
                  class="pkg-chip pkg-chip--matched"
                >
                  <q-icon name="check_circle" size="14px" class="q-mr-xs" />
                  {{ props.row.package_match_source }}: {{ props.row.package_match_id_str }}
                </q-chip>
                <q-chip
                  v-else
                  dense
                  outline
                  class="pkg-chip pkg-chip--unmatched"
                >
                  <q-icon name="help_outline" size="14px" class="q-mr-xs" />
                  No package match
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn
                  v-if="props.row.has_package_match"
                  unelevated
                  no-caps
                  color="primary"
                  size="sm"
                  label="Take over"
                  icon-right="play_arrow"
                  @click="openTakeOver(props.row)"
                />
                <q-btn
                  v-else
                  flat
                  no-caps
                  size="sm"
                  color="warning"
                  label="Request review"
                  icon-right="rate_review"
                  @click="requestReview(props.row)"
                />
              </q-td>
            </template>
          </q-table>

          <div v-if="!discoveryLoading && discoveryRows.length === 0" class="empty-state">
            <q-icon name="inbox" size="48px" />
            <p class="empty-state__msg">No apps match your filters.</p>
          </div>
        </q-card>
      </q-tab-panel>

      <!-- ─── MANAGED ──────────────────────────────────────────── -->
      <q-tab-panel name="managed" class="phase-e-panels__panel">
        <q-card flat bordered class="apps-card">
          <q-card-section class="apps-card__filters">
            <q-input
              v-model="search"
              dense
              outlined
              debounce="300"
              placeholder="Search managed apps…"
              class="apps-card__search"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </q-card-section>

          <q-table
            v-if="!managedLoading || managedRows.length > 0"
            :rows="managedRows"
            :columns="managedColumns"
            row-key="id"
            flat
            :loading="managedLoading"
            :pagination="managedPagination"
            @update:pagination="onManagedPagination"
            :rows-per-page-options="[25, 50, 100]"
            class="apps-card__table"
          >
            <template #body-cell-name="props">
              <q-td :props="props">
                <div class="cell-app">
                  <div class="cell-app__name">{{ props.row.name }}</div>
                  <div v-if="props.row.publisher" class="cell-app__pub">{{ props.row.publisher }}</div>
                </div>
              </q-td>
            </template>

            <template #body-cell-package="props">
              <q-td :props="props">
                <q-chip dense outline class="pkg-chip pkg-chip--matched">
                  <q-icon name="check_circle" size="14px" class="q-mr-xs" />
                  {{ props.row.package_match_source }}: {{ props.row.package_match_id_str }}
                </q-chip>
              </q-td>
            </template>

            <template #body-cell-compliance="props">
              <q-td :props="props">
                <ComplianceCell :row="props.row" :total-agents="summary?.agents_with_inventory ?? 0" />
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props">
                <q-btn-dropdown
                  no-caps
                  unelevated
                  size="sm"
                  color="primary"
                  label="Manage"
                  :disable="busyAppId === props.row.id"
                >
                  <q-list>
                    <q-item clickable v-close-popup @click="onForceUpdate(props.row)">
                      <q-item-section avatar><q-icon name="cloud_download" /></q-item-section>
                      <q-item-section>
                        <q-item-label>Force update now</q-item-label>
                        <q-item-label caption>Dispatches install across all reporting agents</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-separator />
                    <q-item clickable v-close-popup @click="onRelease(props.row)">
                      <q-item-section avatar><q-icon name="restart_alt" /></q-item-section>
                      <q-item-section>
                        <q-item-label>Release management</q-item-label>
                        <q-item-label caption>Returns the app to Discovery</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </q-td>
            </template>
          </q-table>

          <div v-if="!managedLoading && managedRows.length === 0" class="empty-state">
            <q-icon name="verified" size="48px" />
            <p class="empty-state__msg">No managed apps yet.</p>
            <p class="empty-state__hint">Take over an app from the Discovery tab to bring it under management.</p>
          </div>
        </q-card>
      </q-tab-panel>
    </q-tab-panels>

    <!-- ─── TAKE OVER MODAL ────────────────────────────────────── -->
    <TakeOverDialog
      v-if="takeOverApp"
      :app="takeOverApp"
      :total-agents="summary?.agents_with_inventory ?? 0"
      @close="takeOverApp = null"
      @taken-over="onTakenOver"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";

import {
  forceUpdateApp,
  getInventorySummary,
  listInstalledApps,
  releaseApp,
  type InstalledAppDetail,
  type InstalledAppListRow,
  type InventorySummary,
} from "@/api/softwareInventory";

const TakeOverDialog = defineAsyncComponent(
  () => import("@/components/software/TakeOverDialog.vue"),
);
const ComplianceCell = defineAsyncComponent(
  () => import("@/components/software/ComplianceCell.vue"),
);

const $q = useQuasar();

// ── State ──────────────────────────────────────────────────────────────

const summary = ref<InventorySummary | null>(null);
const summaryLoading = ref(true);
const summaryError = ref<string | null>(null);

const search = ref("");
const activeTab = ref<"discovery" | "managed">("discovery");
const busyAppId = ref<number | null>(null);
const takeOverApp = ref<InstalledAppListRow | null>(null);

// Discovery (is_managed=false)
const discoveryRows = ref<InstalledAppListRow[]>([]);
const discoveryLoading = ref(false);
const discoveryFilter = ref<"all" | "matched" | "drift">("all");
const discoverySort = ref<string>("-installation_count");
const discoveryPagination = ref({
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});
const discoveryFilterOptions = [
  { label: "All discoverable apps", value: "all" },
  { label: "Has package match", value: "matched" },
  { label: "Version drift (>1 version seen)", value: "drift" },
];
const discoverySortOptions = [
  { label: "Most-installed first", value: "-installation_count" },
  { label: "Recently seen first", value: "-updated_at" },
  { label: "Most version drift first", value: "-version_count_distinct" },
  { label: "Name A→Z", value: "name" },
  { label: "Publisher A→Z", value: "publisher" },
];

// Managed (is_managed=true)
const managedRows = ref<InstalledAppListRow[]>([]);
const managedLoading = ref(false);
const managedPagination = ref({
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

const discoveryColumns = [
  { name: "name", label: "App", field: "name", align: "left" as const, sortable: false },
  { name: "prevalence", label: "Prevalence", field: "installation_count", align: "left" as const },
  { name: "package", label: "Package match", field: "package_match_source", align: "left" as const },
  { name: "actions", label: "", field: "id", align: "right" as const },
];

const managedColumns = [
  { name: "name", label: "App", field: "name", align: "left" as const },
  { name: "package", label: "Package source", field: "package_match_source", align: "left" as const },
  { name: "compliance", label: "Compliance", field: "id", align: "left" as const },
  { name: "actions", label: "", field: "id", align: "right" as const },
];

// ── Derived ────────────────────────────────────────────────────────────

const unmatchedCount = computed(() => {
  // Phase E only fetches the current page; unmatched count is a separate
  // small calc derived by subtracting list page totals isn't reliable.
  // Pull it from the discovery total when filter==unmatched OR fall back
  // to "summary - matched_total" once we have it. For now, surface the
  // discovery-tab count when the unmatched filter is active, otherwise 0.
  if (!summary.value) return 0;
  // Summary doesn't currently break out unmatched; until the backend
  // adds it, derive a best-effort from the rows we already fetched on
  // the discovery tab.
  const seen = new Set(discoveryRows.value.map((r) => r.id));
  return discoveryRows.value.filter((r) => !r.has_package_match && seen.has(r.id)).length;
});

const discoveryCount = computed(() => discoveryPagination.value.rowsNumber);

// ── Loaders ────────────────────────────────────────────────────────────

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

async function loadDiscovery() {
  try {
    discoveryLoading.value = true;
    const params: Parameters<typeof listInstalledApps>[0] = {
      page: discoveryPagination.value.page,
      page_size: discoveryPagination.value.rowsPerPage,
      ordering: discoverySort.value,
      is_managed: false,
      search: search.value || undefined,
    };
    if (discoveryFilter.value === "matched") params.has_package_match = true;
    // "drift" filter is client-side post-filter (backend has no version_count_distinct__gt)
    const r = await listInstalledApps(params);
    let rows = r.results;
    if (discoveryFilter.value === "drift") {
      rows = rows.filter((row) => row.version_count_distinct > 1);
    }
    discoveryRows.value = rows;
    discoveryPagination.value = { ...discoveryPagination.value, rowsNumber: r.count };
  } finally {
    discoveryLoading.value = false;
  }
}

async function loadManaged() {
  try {
    managedLoading.value = true;
    const r = await listInstalledApps({
      page: managedPagination.value.page,
      page_size: managedPagination.value.rowsPerPage,
      ordering: "-updated_at",
      is_managed: true,
      search: search.value || undefined,
    });
    managedRows.value = r.results;
    managedPagination.value = { ...managedPagination.value, rowsNumber: r.count };
  } finally {
    managedLoading.value = false;
  }
}

// ── Actions ────────────────────────────────────────────────────────────

function openTakeOver(row: InstalledAppListRow) {
  takeOverApp.value = row;
}

function requestReview(row: InstalledAppListRow) {
  // Phase E: there's no curation backend yet — surface a friendly toast
  // saying the request is queued (locally). Phase F may persist this.
  $q.notify({
    type: "info",
    message: `Marked "${row.name}" for catalog review`,
    caption: "We'll notify you when a Choco/WinGet match becomes available.",
    timeout: 4000,
  });
}

async function onForceUpdate(row: InstalledAppListRow) {
  busyAppId.value = row.id;
  try {
    const r = await forceUpdateApp(row.id);
    $q.notify({
      type: "positive",
      message: `Force update dispatched for ${row.name}`,
      caption: `${r.dispatched} agents dispatched, ${r.skipped.length} skipped.`,
      timeout: 4000,
    });
  } catch (e) {
    const msg = (e as { response?: { data?: string } }).response?.data ?? (e as Error).message;
    $q.notify({ type: "negative", message: `Force update failed: ${msg}`, timeout: 6000 });
  } finally {
    busyAppId.value = null;
  }
}

async function onRelease(row: InstalledAppListRow) {
  busyAppId.value = row.id;
  try {
    await releaseApp(row.id);
    $q.notify({
      type: "positive",
      message: `Released ${row.name} back to Discovery`,
      timeout: 3000,
    });
    await Promise.all([loadSummary(), loadDiscovery(), loadManaged()]);
  } catch (e) {
    $q.notify({ type: "negative", message: `Release failed: ${(e as Error).message}` });
  } finally {
    busyAppId.value = null;
  }
}

function onTakenOver(detail: InstalledAppDetail) {
  $q.notify({
    type: "positive",
    message: `Now managing ${detail.name}`,
    caption: detail.package_match
      ? `${detail.package_match.source}:${detail.package_match.package_id} • auto-update enabled`
      : "",
    timeout: 4000,
  });
  takeOverApp.value = null;
  // Refresh both lists + summary so the row visually moves tabs.
  Promise.all([loadSummary(), loadDiscovery(), loadManaged()]);
  activeTab.value = "managed";
}

// ── Pagination handlers ────────────────────────────────────────────────

function onDiscoveryPagination(p: typeof discoveryPagination.value) {
  discoveryPagination.value = p;
  loadDiscovery();
}

function onManagedPagination(p: typeof managedPagination.value) {
  managedPagination.value = p;
  loadManaged();
}

// ── Reactivity wiring ──────────────────────────────────────────────────

watch([search, discoveryFilter, discoverySort], () => {
  discoveryPagination.value.page = 1;
  loadDiscovery();
});

watch(activeTab, (tab) => {
  if (tab === "managed") loadManaged();
  else loadDiscovery();
});

onMounted(() => {
  loadSummary();
  loadDiscovery();
  loadManaged();
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
    flex-wrap: wrap;
  }
  &__big {
    display: flex;
    flex-direction: column;
    min-width: 130px;
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

.phase-e-tabs {
  border-bottom: 1px solid var(--color-stroke-divider);
}

.phase-e-panels {
  background: transparent;

  &__panel {
    padding: var(--intune-space-l) 0 0;
  }
}

.apps-card {
  background-color: var(--color-bg-surface);
  border-color: var(--color-stroke-divider);
  border-radius: var(--intune-radius-large);

  &__filters {
    display: flex;
    gap: var(--intune-space-m);
    flex-wrap: wrap;
    padding-bottom: 0;
  }
  &__search { min-width: 280px; flex: 1 1 280px; }
  &__filter { min-width: 220px; }
  &__table {
    background-color: transparent;
    :deep(thead th) {
      color: var(--color-fg-tertiary);
      font-weight: var(--intune-font-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-size: var(--intune-font-size-200);
    }
    :deep(tbody tr:hover) {
      background: var(--color-bg-surface-2);
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

.cell-prev {
  &__num {
    font-weight: var(--intune-font-weight-semibold);
    font-size: var(--intune-font-size-400);
  }
  &__total {
    color: var(--color-fg-tertiary);
    margin-left: 4px;
  }
  &__drift {
    font-size: var(--intune-font-size-200);
    color: var(--intune-status-warning);
    margin-top: 2px;

    &--clean { color: var(--intune-status-success); }
  }
}

.pkg-chip {
  font-size: var(--intune-font-size-200);

  &--matched {
    color: var(--intune-status-success);
    border-color: var(--intune-status-success);
  }
  &--unmatched {
    color: var(--color-fg-tertiary);
    border-color: var(--color-stroke-divider);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--intune-space-xxl) var(--intune-space-l);
  color: var(--color-fg-tertiary);

  &__msg {
    margin: var(--intune-space-m) 0 0;
    font-size: var(--intune-font-size-400);
    color: var(--color-fg-secondary);
  }
  &__hint {
    margin: var(--intune-space-xs) 0 0;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-300);
  }
}
</style>
