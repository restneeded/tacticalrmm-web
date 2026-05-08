<!--
  TasksRunHistoryTab — Phase N global Run-history tab.

  Backend: GET /tasks/runs/?limit=&since=ISO&status=&task_id=&agent_id=
  (Phase N addition — see api/tacticalrmm/autotasks/views.py#GetTaskRunsFleet.)

  Returns TaskResult rows ordered by last_run desc, denormalised with task
  name/type and agent hostname/agent_id so we don't paginate-N+1 on row
  hydration. Mirrors Phase M's ChecksRunHistoryTab.
-->
<template>
  <div class="hist">
    <header class="hist__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Filter (task, agent, output)…"
        class="hist__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-select
        v-model="statusFilter"
        :options="STATUS_OPTIONS"
        map-options emit-value
        outlined dense
        label="Status"
        class="hist__select"
      />
      <q-input
        v-model.number="limit"
        outlined dense type="number" min="10" max="1000"
        label="Limit"
        class="hist__select hist__select--sm"
      />
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="hist__state">Loading runs…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="hist__state hist__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="hist__state hist__state--empty">
      <q-icon name="history" size="36px" />
      <p v-if="rows.length === 0">No task runs recorded yet.</p>
      <p v-else>No runs match your filters.</p>
    </div>

    <q-table
      v-else
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      :pagination="pagination"
      flat dense
      class="hist__tbl"
      :rows-per-page-options="[25, 50, 100, 200, 500]"
    >
      <template #body-cell-status="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="`chip--${statusTone(p.row)}`">
            {{ p.row.status || "pending" }}
          </span>
        </q-td>
      </template>
      <template #body-cell-task="p">
        <q-td :props="p">
          <div class="hist__name">{{ p.row.task_name || `task #${p.row.task_id}` }}</div>
          <div class="hist__sub">{{ TYPE_LABEL_BRIEF[p.row.task_type] || p.row.task_type }}</div>
        </q-td>
      </template>
      <template #body-cell-agent="p">
        <q-td :props="p">
          <router-link
            v-if="p.row.agent_id"
            :to="{ name: 'DeviceDetail', params: { agent_id: p.row.agent_id } }"
            class="hist__link"
          >
            {{ p.row.agent_hostname || p.row.agent_id }}
          </router-link>
          <span v-else>—</span>
        </q-td>
      </template>
      <template #body-cell-last_run="p">
        <q-td :props="p">{{ formatRelative(p.row.last_run) }}</q-td>
      </template>
      <template #body-cell-duration="p">
        <q-td :props="p">{{ formatDuration(p.row.duration_seconds) }}</q-td>
      </template>
      <template #body-cell-retcode="p">
        <q-td :props="p">{{ p.row.retcode ?? "—" }}</q-td>
      </template>
      <template #body-cell-output="p">
        <q-td :props="p" class="hist__output">
          <span class="hist__output-text">{{ p.row.stdout_preview || "—" }}</span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { fetchTaskRuns } from "@/api/tasks";

const TYPE_LABEL_BRIEF = {
  manual: "Manual",
  runonce: "Run once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  monthlydow: "Monthly DoW",
  checkfailure: "On check fail",
  onboarding: "Onboarding",
  scheduled: "Scheduled (deprecated)",
};

const STATUS_OPTIONS = [
  { value: null,      label: "Any status" },
  { value: "passing", label: "Passing" },
  { value: "failing", label: "Failing" },
  { value: "pending", label: "Pending" },
];

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const search = ref("");
const statusFilter = ref(null);
const limit = ref(200);

const pagination = { rowsPerPage: 50, sortBy: "last_run", descending: true };

defineExpose({ reload });

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const params = { limit: limit.value };
    if (statusFilter.value) params.status = statusFilter.value;
    const data = await fetchTaskRuns(params);
    rows.value = Array.isArray(data) ? data : [];
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load runs";
  }
  loading.value = false;
}

onMounted(reload);
watch([statusFilter, limit], () => { void reload(); });

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) => {
    const hay = `${r.task_name || ""} ${r.agent_hostname || ""} ${r.stdout_preview || ""}`.toLowerCase();
    return hay.includes(q);
  });
});

const columns = [
  { name: "status",   label: "Status",    field: "status",         align: "left" },
  { name: "task",     label: "Task",      field: "task_name",      align: "left", sortable: true },
  { name: "agent",    label: "Agent",     field: "agent_hostname", align: "left", sortable: true },
  { name: "last_run", label: "Ran",       field: "last_run",       align: "left", sortable: true },
  { name: "duration", label: "Duration",  field: "duration_seconds", align: "left" },
  { name: "retcode",  label: "Exit",      field: "retcode",        align: "left" },
  { name: "output",   label: "Output",    field: "stdout_preview", align: "left" },
];

function statusTone(row) {
  if (row.status === "passing") return "positive";
  if (row.status === "failing") return "negative";
  return "neutral";
}

function formatRelative(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return d.toLocaleString();
}
function formatDuration(s) {
  if (s == null) return "—";
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
</script>

<style lang="scss" scoped>
.hist {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  &__search { min-width: 240px; flex: 1 1 240px; max-width: 380px; }
  &__select { min-width: 140px; &--sm { min-width: 90px; max-width: 100px; } }

  &__state {
    padding: 36px 16px;
    color: var(--color-fg-secondary);
    text-align: center;
    background: var(--color-bg-surface);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__tbl {
    background: var(--color-bg-surface);
  }
  &__name { font-weight: 500; }
  &__sub { font-size: 12px; color: var(--color-fg-secondary); }
  &__link { color: var(--color-link, #1c70d8); text-decoration: none; &:hover { text-decoration: underline; } }
  &__output {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__output-text {
    font-family: var(--intune-font-mono, monospace);
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);
  border: 1px solid var(--color-border-subtle);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--negative {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
