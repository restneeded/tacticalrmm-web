<template>
  <div class="deploy-tab">
    <q-card flat bordered class="apps-card">
      <q-card-section class="apps-card__filters">
        <q-input
          v-model="search"
          dense
          outlined
          debounce="200"
          placeholder="Search catalog by app, publisher, or package id…"
          class="apps-card__search"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <q-select
          v-model="sourceFilter"
          :options="sourceOptions"
          dense
          outlined
          emit-value
          map-options
          class="apps-card__filter"
        />

        <q-space />
        <span class="deploy-tab__catalog-count text-caption">
          {{ filteredRows.length }} of {{ catalog.length }} packages
        </span>
      </q-card-section>

      <q-table
        v-if="!loading || filteredRows.length > 0"
        :rows="filteredRows"
        :columns="columns"
        :pagination="paginationModel"
        :rows-per-page-options="[25, 50, 100]"
        row-key="rowKey"
        flat
        :loading="loading"
        class="apps-card__table"
      >
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="cell-app">
              <div class="cell-app__name">{{ props.row.display_name }}</div>
              <div v-if="props.row.publisher" class="cell-app__pub">
                {{ props.row.publisher }}
              </div>
            </div>
          </q-td>
        </template>
        <template #body-cell-source="props">
          <q-td :props="props">
            <q-chip
              dense
              outline
              :class="`pkg-chip pkg-chip--${props.row.source}`"
            >
              {{ props.row.source }}: {{ props.row.package_id }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-version="props">
          <q-td :props="props">
            <span v-if="props.row.latest_version_known" class="deploy-tab__ver">
              {{ props.row.latest_version_known }}
            </span>
            <span v-else class="deploy-tab__ver-unknown">—</span>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              unelevated
              no-caps
              size="sm"
              color="primary"
              icon-right="rocket_launch"
              label="Deploy"
              @click="onDeploy(props.row)"
            />
          </q-td>
        </template>
      </q-table>

      <div v-if="!loading && filteredRows.length === 0" class="empty-state">
        <q-icon name="search_off" size="48px" />
        <p class="empty-state__msg">No packages match your filter.</p>
      </div>
    </q-card>

    <q-card flat bordered class="recent-deploys q-mt-lg">
      <q-card-section class="recent-deploys__header">
        <div class="recent-deploys__title">Recent deploys</div>
        <q-btn
          flat
          dense
          no-caps
          size="sm"
          icon="refresh"
          label="Refresh"
          @click="loadJobs"
          :disable="jobsLoading"
        />
      </q-card-section>
      <q-list separator>
        <q-item
          v-for="j in jobs"
          :key="j.id"
          clickable
          @click="onSelectJob(j)"
          class="recent-deploys__row"
        >
          <q-item-section avatar>
            <q-icon
              :name="j.kind === 'auto-update' ? 'autorenew' : 'rocket_launch'"
              :class="`recent-deploys__icon recent-deploys__icon--${j.status}`"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ j.package_display || j.package }}
              <q-chip
                v-if="j.kind === 'auto-update'"
                dense
                outline
                size="xs"
                class="recent-deploys__kind"
              >auto-update</q-chip>
            </q-item-label>
            <q-item-label caption>
              <span :class="`recent-deploys__status recent-deploys__status--${j.status}`">
                {{ j.status }}
              </span>
              · {{ j.dispatched_count }} dispatched · {{ j.skipped_count }} skipped
              · {{ formatRelative(j.created_at) }}
              <span v-if="j.created_by"> · by {{ j.created_by }}</span>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" />
          </q-item-section>
        </q-item>
        <q-item v-if="jobs.length === 0 && !jobsLoading" class="recent-deploys__empty">
          <q-item-section>
            <q-item-label class="text-caption">
              No deploys yet. Pick a package above and dispatch one.
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <DeployDialog
      v-if="selectedPackage"
      :pkg="selectedPackage"
      @close="selectedPackage = null"
      @deployed="onDeployed"
    />

    <q-drawer
      v-model="drawerOpen"
      side="right"
      overlay
      bordered
      :width="520"
      class="deploy-tab__drawer"
    >
      <div v-if="selectedJobDetail" class="deploy-tab__drawer-body">
        <div class="deploy-tab__drawer-head">
          <div>
            <div class="deploy-tab__drawer-title">
              {{ selectedJobDetail.package_display || selectedJobDetail.package }}
            </div>
            <div class="text-caption">
              Job #{{ selectedJobDetail.id }} · {{ selectedJobDetail.kind }}
              · <span :class="`recent-deploys__status recent-deploys__status--${selectedJobDetail.status}`">{{ selectedJobDetail.status }}</span>
            </div>
          </div>
          <q-btn flat round dense icon="close" @click="drawerOpen = false" aria-label="Close" />
        </div>
        <q-separator />
        <div class="deploy-tab__drawer-stats">
          <div class="deploy-tab__stat">
            <div class="deploy-tab__stat-num">{{ selectedJobDetail.total_agents }}</div>
            <div class="deploy-tab__stat-lbl">total agents</div>
          </div>
          <div class="deploy-tab__stat">
            <div class="deploy-tab__stat-num">{{ selectedJobDetail.dispatched_count }}</div>
            <div class="deploy-tab__stat-lbl">dispatched</div>
          </div>
          <div class="deploy-tab__stat">
            <div class="deploy-tab__stat-num">{{ selectedJobDetail.skipped_count }}</div>
            <div class="deploy-tab__stat-lbl">skipped</div>
          </div>
        </div>
        <q-list separator class="deploy-tab__drawer-list">
          <q-item v-for="a in selectedJobDetail.agents" :key="a.id">
            <q-item-section>
              <q-item-label>{{ a.hostname }}</q-item-label>
              <q-item-label caption>
                {{ a.client }}{{ a.site ? ` / ${a.site}` : '' }}
              </q-item-label>
              <q-item-label v-if="a.skip_reason" caption class="deploy-tab__skip-reason">
                {{ a.skip_reason }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip
                dense
                outline
                size="sm"
                :class="`pkg-chip recent-deploys__status--${a.status}`"
              >
                {{ a.status }}
              </q-chip>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useQuasar } from "quasar";

import {
  getDeployJob,
  listCatalog,
  listDeployJobs,
  type CatalogPackage,
  type DeployCreateResponse,
  type DeployJobDetailResponse,
  type DeployJobSummary,
} from "@/api/softwareInventory";

const DeployDialog = defineAsyncComponent(
  () => import("@/components/software/DeployDialog.vue"),
);

const $q = useQuasar();

const catalog = ref<CatalogPackage[]>([]);
const loading = ref(false);
const search = ref("");
const sourceFilter = ref<"all" | "choco" | "winget">("all");
const sourceOptions = [
  { label: "All sources", value: "all" },
  { label: "Chocolatey only", value: "choco" },
  { label: "WinGet only", value: "winget" },
];

const jobs = ref<DeployJobSummary[]>([]);
const jobsLoading = ref(false);

const selectedPackage = ref<CatalogPackage | null>(null);
const selectedJobDetail = ref<DeployJobDetailResponse | null>(null);
const drawerOpen = ref(false);

const paginationModel = ref({
  rowsPerPage: 25,
  page: 1,
  sortBy: "display_name" as string | null,
  descending: false,
});

const columns = [
  { name: "name", label: "Package", field: "display_name", align: "left" as const, sortable: true },
  { name: "source", label: "Source · package id", field: "package_id", align: "left" as const, sortable: true },
  { name: "version", label: "Latest known", field: "latest_version_known", align: "left" as const, sortable: false },
  { name: "actions", label: "", field: "package_id", align: "right" as const, sortable: false },
];

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return catalog.value
    .filter((r) => sourceFilter.value === "all" || r.source === sourceFilter.value)
    .filter(
      (r) =>
        !q ||
        r.display_name.toLowerCase().includes(q) ||
        r.publisher.toLowerCase().includes(q) ||
        r.package_id.toLowerCase().includes(q),
    )
    .map((r) => ({ ...r, rowKey: `${r.source}:${r.package_id}` }));
});

async function loadCatalog() {
  loading.value = true;
  try {
    const r = await listCatalog();
    catalog.value = r.results;
  } catch (e) {
    $q.notify({ type: "negative", message: `Couldn't load catalog: ${(e as Error).message}` });
  } finally {
    loading.value = false;
  }
}

async function loadJobs() {
  jobsLoading.value = true;
  try {
    const r = await listDeployJobs();
    jobs.value = r.results.slice(0, 5);
  } finally {
    jobsLoading.value = false;
  }
}

// Phase G: poll the recent-deploys panel while any visible job is non-
// terminal. Stops on its own as soon as everything reaches done|partial|
// failed or when the component unmounts.
const TERMINAL_STATUSES = new Set(["done", "partial", "failed"]);
let pollTimer: ReturnType<typeof setInterval> | null = null;
function ensurePollingMatchesState() {
  const active = jobs.value.some((j) => !TERMINAL_STATUSES.has(j.status));
  if (active && pollTimer === null) {
    pollTimer = setInterval(() => {
      loadJobs().catch(() => { /* swallow — next tick will retry */ });
    }, 5000);
  } else if (!active && pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
watch(jobs, ensurePollingMatchesState, { deep: true });
onBeforeUnmount(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

function onDeploy(row: CatalogPackage) {
  selectedPackage.value = row;
}

async function onDeployed(resp: DeployCreateResponse) {
  selectedPackage.value = null;
  await loadJobs();
  // Phase G: the response is now async-style (status=queued, no
  // dispatched/skipped totals). Surface that in the toast and let the
  // polling loop reflect the real outcome on the recent-deploys panel.
  if (resp.skipped_already_installed.length > 0) {
    $q.notify({
      type: "warning",
      message: `Deploy queued (#${resp.job_id})`,
      caption: `${resp.skipped_already_installed.length} agents already had this app — they were skipped. The dispatch worker is now processing the rest.`,
      timeout: 6000,
    });
  } else {
    $q.notify({
      type: "positive",
      message: `Deploy queued (#${resp.job_id})`,
      caption: `Targeting ${resp.total_agents} agent${resp.total_agents === 1 ? "" : "s"}. Status will update as the worker dispatches.`,
      timeout: 4000,
    });
  }
}

async function onSelectJob(job: DeployJobSummary) {
  try {
    selectedJobDetail.value = await getDeployJob(job.id);
    drawerOpen.value = true;
  } catch (e) {
    $q.notify({ type: "negative", message: `Couldn't load job: ${(e as Error).message}` });
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

onMounted(() => {
  loadCatalog();
  loadJobs();
});

watch([sourceFilter, search], () => {
  paginationModel.value.page = 1;
});
</script>

<style lang="scss" scoped>
.deploy-tab {
  &__catalog-count {
    color: var(--color-fg-tertiary);
    align-self: center;
  }
  &__ver { font-variant-numeric: tabular-nums; }
  &__ver-unknown { color: var(--color-fg-tertiary); }

  &__drawer-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  &__drawer-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--intune-space-l);
  }
  &__drawer-title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__drawer-stats {
    display: flex;
    gap: var(--intune-space-xl);
    padding: var(--intune-space-l);
    border-bottom: 1px solid var(--color-stroke-divider);
  }
  &__stat-num {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__stat-lbl {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
  &__drawer-list {
    overflow-y: auto;
    flex: 1;
  }
  &__skip-reason {
    color: var(--intune-status-warning);
  }
}

.recent-deploys {
  background-color: var(--color-bg-surface);
  border-color: var(--color-stroke-divider);
  border-radius: var(--intune-radius-large);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  &__title {
    font-weight: var(--intune-font-weight-semibold);
    font-size: var(--intune-font-size-400);
  }
  &__row { padding: var(--intune-space-s) var(--intune-space-m); }
  &__icon {
    &--queued, &--running { color: var(--intune-status-info); }
    &--done, &--succeeded { color: var(--intune-status-success); }
    &--failed { color: var(--intune-status-danger); }
    &--partial { color: var(--intune-status-warning); }
  }
  &__status {
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-semibold);

    &--done, &--succeeded { color: var(--intune-status-success); }
    &--failed { color: var(--intune-status-danger); }
    &--partial { color: var(--intune-status-warning); }
    &--queued, &--running, &--pending, &--dispatched { color: var(--intune-status-info); }
    &--skipped { color: var(--color-fg-tertiary); }
  }
  &__kind { background: transparent; }
  &__empty { color: var(--color-fg-tertiary); }
}

.pkg-chip {
  font-size: var(--intune-font-size-200);
  &--choco { color: #80b918; border-color: #80b918; }
  &--winget { color: #0078d4; border-color: #0078d4; }
}
</style>
