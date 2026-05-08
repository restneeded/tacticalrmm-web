<!--
  ScriptsScheduledTab — read-only AutomatedTask list.

  ⚠ SCOPE NOTE: Phase L does NOT own the scheduling editor — that
  belongs to Phase N (Tasks editor). This tab is intentionally read-only.
  Each row links to /legacy/agents/<id>?tab=automation so the user can
  still edit the schedule in the legacy UI until Phase N ships, at which
  point the link gets pointed at the new editor.

  Backend: GET /tasks/  — returns AutomatedTask rows for the current
  user's role (already exists, used by legacy UI).
-->
<template>
  <div class="sched">
    <div class="sched__notice">
      <q-icon name="info" size="18px" />
      <span>
        The full editor lives in Tasks (the new home). Click any row to jump there.
      </span>
    </div>

    <header class="sched__bar">
      <q-input v-model="search" dense outlined clearable placeholder="Search task name…"
               class="sched__search">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-toggle v-model="enabledOnly" label="Enabled only" left-label dense />
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload" />
    </header>

    <div v-if="loading && rows.length === 0" class="sched__state">Loading scheduled tasks…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="sched__state sched__state--error">
      Couldn't load tasks: {{ errorMsg }}
    </div>
    <div v-else-if="filtered.length === 0" class="sched__state">
      <q-icon name="schedule" size="32px" />
      <div>No scheduled tasks.</div>
      <div class="sched__hint">Use the Tasks page for full editing.</div>
    </div>
    <div v-else class="sched__table">
      <div class="sched__head">
        <span>Name</span>
        <span>Schedule</span>
        <span>Agent / Policy</span>
        <span>Enabled</span>
        <span>Last run</span>
        <span>Next run</span>
        <span></span>
      </div>
      <div
        v-for="row in filtered"
        :key="row.id"
        class="sched__row"
        @click="viewInTasks(row)"
      >
        <span class="sched__name" :title="row.name || ''">{{ row.name || "(unnamed)" }}</span>
        <span>{{ row.schedule || taskTypeLabel(row.task_type) }}</span>
        <span>{{ targetLabel(row) }}</span>
        <span>
          <q-badge :color="row.enabled ? 'green' : 'grey'" outline>
            {{ row.enabled ? "Yes" : "No" }}
          </q-badge>
        </span>
        <span>{{ formatDate(row.task_result?.last_run) }}</span>
        <span>{{ formatDate(row.run_time_date) }}</span>
        <span>
          <q-btn flat dense round icon="open_in_new" size="sm" @click.stop="viewInTasks(row)">
            <q-tooltip>Open in /tasks</q-tooltip>
          </q-btn>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { fetchTasks } from "@/api/tasks";
import { useRouter } from "vue-router";

interface TaskRow {
  id: number;
  name: string;
  task_type: string;
  enabled: boolean;
  schedule?: string | null;
  run_time_date?: string | null;
  task_result?: { last_run?: string | null; retcode?: number } | null;
  agent?: number | null;
  policy?: number | null;
  alert_severity?: string;
}

const router = useRouter();

const rows         = ref<TaskRow[]>([]);
const loading      = ref(true);
const errorMsg     = ref("");
const search       = ref("");
const enabledOnly  = ref(false);

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchTasks();
    rows.value = Array.isArray(data) ? data as TaskRow[] : [];
  } catch (err) {
    errorMsg.value = extract(err);
  } finally {
    loading.value = false;
  }
}

const filtered = computed<TaskRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (enabledOnly.value && !r.enabled) return false;
    if (q && !(r.name || "").toLowerCase().includes(q)) return false;
    return true;
  });
});

function viewInTasks(row: TaskRow) {
  // Phase N: hand off to the new /tasks landing. The Library tab lists every
  // task; we pass `?id=` so future polish can deep-link the editor drawer.
  // For now this just lands the user at the right page — the row is one
  // click away.
  void router.push({ path: "/tasks", query: { id: String(row.id) } });
}

function taskTypeLabel(t: string): string {
  if (!t) return "—";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function targetLabel(r: TaskRow): string {
  if (r.agent)  return `Agent #${r.agent}`;
  if (r.policy) return `Policy #${r.policy}`;
  return "—";
}
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
function extract(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  return d || e?.message || "request failed";
}

onMounted(reload);
defineExpose({ reload });
</script>

<style lang="scss" scoped>
.sched {
  display: flex; flex-direction: column; gap: 12px;

  &__notice {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-fg-secondary);
    border-radius: 6px;
    font-size: 12.5px;
  }

  &__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  &__search { min-width: 240px; }

  &__state {
    color: var(--color-fg-secondary); padding: 32px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    text-align: center;
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }
  &__hint { font-size: 12px; color: var(--color-fg-tertiary); }

  &__table {
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-bg-surface);
    overflow: hidden;
  }
  &__head, &__row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1.5fr) 160px 90px 160px 160px 40px;
    gap: 10px; padding: 8px 14px; font-size: 13px; align-items: center;
  }
  &__head {
    color: var(--color-fg-secondary);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
    font-weight: 600;
    background: var(--color-bg-page);
    border-bottom: 1px solid var(--color-border-subtle);
  }
  &__row {
    border-bottom: 1px solid var(--color-border-subtle);
    cursor: pointer;
    &:hover { background: var(--color-bg-page); }
    &:last-child { border-bottom: none; }
  }
  &__name { font-weight: var(--intune-font-weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
</style>
