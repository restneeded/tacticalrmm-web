<!--
  PendingActionsPage — Phase R /pending route under AppShell.

  Live-poll table of TRMM PendingAction rows. The upstream PA model has
  only {pending, completed} statuses (no failed/canceled), so this page
  exposes "cancel" as the only mutation; selecting completed rows is
  a no-op for cancel. Polling auto-stops on 4xx via the axios
  interceptor (Phase L pattern); we additionally drop polling whenever
  the tab loses focus to keep traffic sane on long-lived tabs.
-->
<template>
  <q-page class="pap">
    <header class="pap__hero">
      <div>
        <h1 class="pap__title">Pending actions</h1>
        <p class="pap__lede">
          What TRMM has scheduled to run on agents that hasn't fired yet.
          Cancel anything that's no longer wanted.
        </p>
      </div>
      <div class="pap__hero-meta">
        <span class="pap__count">
          <strong>{{ pendingCount }}</strong> queued
          <span v-if="completedCount" class="pap__count-extra">
            · {{ completedCount }} completed
          </span>
        </span>
        <span v-if="autoRefresh" class="pap__sync" title="Auto-refresh every 5s">
          <q-spinner-dots size="14px" /> live
        </span>
        <q-toggle
          v-model="autoRefresh"
          dense
          label="Auto-refresh"
          color="primary"
        />
        <q-btn
          flat dense icon="refresh" color="primary" aria-label="Refresh"
          @click="reload"
        />
      </div>
    </header>

    <PendingFilterBand
      v-model:actionFilter="filters.actionFilter"
      v-model:statusFilter="filters.statusFilter"
      v-model:search="filters.search"
    />

    <div v-if="selected.length" class="pap__bulk">
      <span>{{ selected.length }} selected</span>
      <q-btn
        unelevated dense color="negative" no-caps
        :loading="bulkBusy"
        :disable="bulkBusy || selectedCancellable.length === 0"
        @click="onBulkCancel"
      >
        Cancel {{ selectedCancellable.length }}
      </q-btn>
      <q-btn flat dense no-caps @click="selected = []">Clear</q-btn>
    </div>

    <q-table
      class="pap__table"
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      flat bordered dense
      :loading="loading"
      v-model:pagination="pagination"
      :rows-per-page-options="[25, 50, 100, 200]"
      :selection="'multiple'"
      v-model:selected="selected"
      @row-click="onRowClick"
      :no-data-label="loading ? 'Loading…' : 'Nothing pending. Fleet is caught up.'"
    >
      <template #body-cell-action_type="p">
        <q-td :props="p">{{ formatActionType(p.row.action_type) }}</q-td>
      </template>
      <template #body-cell-status="p">
        <q-td :props="p">
          <span class="pap__chip" :data-kind="p.row.status">
            {{ p.row.status }}
          </span>
        </q-td>
      </template>
      <template #body-cell-agent="p">
        <q-td :props="p">
          <router-link
            v-if="p.row.agent_id"
            :to="`/devices/${p.row.agent_id}`"
            class="pap__link"
          >{{ p.row.hostname || p.row.agent_id }}</router-link>
          <span v-else>{{ p.row.hostname || "—" }}</span>
        </q-td>
      </template>
      <template #body-cell-due="p">
        <q-td :props="p">{{ p.row.due }}</q-td>
      </template>
      <template #body-cell-entry_time="p">
        <q-td :props="p">
          <span :title="absoluteTime(p.value)">{{ relativeTime(p.value) }}</span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" auto-width>
          <q-btn
            flat dense round size="sm" icon="close" color="negative"
            :disable="p.row.status !== 'pending'"
            @click.stop="onCancel(p.row)"
            aria-label="Cancel action"
          >
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <PendingDetailDrawer
      v-if="activeRow"
      :row="activeRow"
      @close="activeRow = null"
      @cancel="onCancel(activeRow!)"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useQuasar } from "quasar";

import {
  cancelPendingAction,
  fetchPendingActions,
  formatActionType,
  type PendingActionRow,
} from "@/api/pending";

import PendingFilterBand   from "@/components/pending/PendingFilterBand.vue";
import PendingDetailDrawer from "@/components/pending/PendingDetailDrawer.vue";

const $q = useQuasar();

const filters = reactive({
  actionFilter: [] as string[],
  statusFilter: [] as string[],   // ["pending","completed"]
  search: "",
});

const rows    = ref<PendingActionRow[]>([]);
const loading = ref(false);

const autoRefresh = ref(true);
let pollHandle: number | null = null;
let pollInflight = false;

const columns = [
  { name: "action_type", label: "Action", field: "action_type", align: "left" as const, sortable: true },
  { name: "status",      label: "Status", field: "status",      align: "left" as const, sortable: true },
  { name: "agent",       label: "Agent",  field: "hostname",    align: "left" as const },
  { name: "due",         label: "Due",    field: "due",         align: "left" as const },
  { name: "entry_time",  label: "Queued", field: "entry_time",  align: "left" as const, sortable: true },
  { name: "actions",     label: "",       field: "id",          align: "right" as const },
];

const pagination = ref({
  sortBy: "entry_time",
  descending: true,
  page: 1,
  rowsPerPage: 50,
});

const filteredRows = computed(() => {
  return rows.value.filter(r => {
    if (filters.actionFilter.length && !filters.actionFilter.includes(r.action_type)) return false;
    if (filters.statusFilter.length && !filters.statusFilter.includes(r.status))      return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!(r.hostname?.toLowerCase().includes(s)
         || r.action_type?.toLowerCase().includes(s)
         || (r.description ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  });
});

const pendingCount   = computed(() => filteredRows.value.filter(r => r.status === "pending").length);
const completedCount = computed(() => filteredRows.value.filter(r => r.status === "completed").length);

// --- Selection ---
const selected = ref<PendingActionRow[]>([]);
const selectedCancellable = computed(() => selected.value.filter(r => r.status === "pending"));

async function load(quiet = false) {
  if (pollInflight) return;
  pollInflight = true;
  if (!quiet) loading.value = true;
  try {
    rows.value = await fetchPendingActions();
  } catch (e) {
    // Polling auto-stops on 4xx via interceptor; otherwise leave the
    // last known rows in place.
    if (!quiet) {
      // eslint-disable-next-line no-console
      console.error("[pending] load:", e);
      $q.notify({ type: "negative", message: "Could not load pending actions." });
    }
  } finally {
    loading.value = false;
    pollInflight = false;
  }
}

function reload() { void load(); }

function startPoll() {
  stopPoll();
  pollHandle = window.setInterval(() => {
    if (!autoRefresh.value || document.hidden) return;
    void load(true);
  }, 5_000);
}
function stopPoll() {
  if (pollHandle !== null) { window.clearInterval(pollHandle); pollHandle = null; }
}
watch(autoRefresh, v => { if (v) startPoll(); else stopPoll(); });

// --- Cancel ---
const bulkBusy = ref(false);

async function onCancel(row: PendingActionRow) {
  if (row.status !== "pending") return;
  $q.dialog({
    title: "Cancel pending action?",
    message: `Cancel "${formatActionType(row.action_type)}" on ${row.hostname || row.agent_id}?`,
    cancel: true,
    persistent: false,
  }).onOk(async () => {
    try {
      await cancelPendingAction(row.id);
      $q.notify({ type: "positive", message: "Cancelled." });
      await load(true);
    } catch (e) {
      $q.notify({ type: "negative", message: "Could not cancel." });
    }
  });
}

async function onBulkCancel() {
  if (selectedCancellable.value.length === 0) return;
  $q.dialog({
    title: "Cancel selected?",
    message: `Cancel ${selectedCancellable.value.length} pending action(s)?`,
    cancel: true,
  }).onOk(async () => {
    bulkBusy.value = true;
    let ok = 0; let fail = 0;
    try {
      // Sequential to surface NATS-side errors clearly, also keeps the
      // server side honest under our small fleet sizes.
      for (const r of selectedCancellable.value) {
        try { await cancelPendingAction(r.id); ok += 1; } catch { fail += 1; }
      }
    } finally {
      bulkBusy.value = false;
    }
    selected.value = [];
    if (fail) $q.notify({ type: "warning", message: `Cancelled ${ok}, ${fail} failed.` });
    else      $q.notify({ type: "positive", message: `Cancelled ${ok}.` });
    await load(true);
  });
}

// --- Drawer ---
const activeRow = ref<PendingActionRow | null>(null);
function onRowClick(_e: Event, row: PendingActionRow) { activeRow.value = row; }

// --- Helpers ---
function relativeTime(t: string): string {
  if (!t) return "—";
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)         return `${Math.round(diff)}s ago`;
  if (diff < 3600)       return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7)  return `${Math.round(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
function absoluteTime(t: string): string { return t ? new Date(t).toLocaleString() : ""; }

onMounted(() => { void load(); startPoll(); });
onUnmounted(() => stopPoll());
</script>

<style lang="scss" scoped>
.pap {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 24px;
    margin-bottom: 12px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    max-width: 720px; margin: 0;
  }
  &__hero-meta {
    display: flex; align-items: center; gap: 12px;
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
  }
  &__count strong {
    color: var(--color-fg-primary);
    font-size: var(--intune-font-size-400);
    margin-right: 4px;
  }
  &__count-extra { color: var(--color-fg-tertiary); }
  &__sync {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
  &__bulk {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 12px;
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    margin: 8px 0;
  }
  &__table {
    margin-top: 12px;
    background: var(--color-bg-surface-1);
  }
  &__link {
    color: var(--color-fg-link, #2667c6);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  &__chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--intune-radius-circular);
    font-size: var(--intune-font-size-200);
    background: var(--color-bg-surface-2);
    color: var(--color-fg-secondary);
    border: 1px solid var(--color-stroke-divider);
    text-transform: capitalize;
    &[data-kind="pending"]   { background: rgba( 32,128,232, 0.12); color: #1f5fbb; border-color: rgba(32,128,232, 0.4); }
    &[data-kind="completed"] { background: rgba( 16,160, 96, 0.14); color: #1c7a4d; border-color: rgba(16,160, 96, 0.4); }
  }
}
</style>
