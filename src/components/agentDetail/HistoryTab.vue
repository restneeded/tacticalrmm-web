<!--
  HistoryTab — agent activity timeline.

  Endpoint: GET /agents/<id>/history/  (legacy, returns list ordered desc).
  Upstream AgentHistoryType: task_run | script_run | cmd_run.

  We surface those plus a "filter by type" pill row, with a search filter
  for command/script-name. Clicking a row opens an output drawer with the
  full results / script_results.

  Pagination: the legacy endpoint isn't paginated. Capping at 500 client-
  side keeps the table responsive without backend changes; if Rest wants
  proper server-side pagination later it's a one-line view tweak.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <div class="ad-tab__filters">
        <button
          v-for="t in TYPE_FILTERS"
          :key="t.value"
          class="filter"
          :class="{ 'filter--active': typeFilter === t.value }"
          @click="typeFilter = t.value"
        >
          {{ t.label }}
        </button>
      </div>
      <q-space />
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Search command, script, user…"
        class="ad-tab__search"
      />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        :loading="loading"
        @click="load"
      />
    </header>

    <div v-if="loading && rows.length === 0" class="state">Loading history…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="state state--error">
      Couldn't load history: {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="state">
      No history rows match the current filter.
    </div>
    <div v-else class="table">
      <div class="table__head">
        <span>Time</span>
        <span>Type</span>
        <span>What</span>
        <span>By</span>
        <span>Result</span>
        <span></span>
      </div>
      <div
        v-for="row in pagedRows"
        :key="row.id"
        class="table__row"
        @click="openRow(row)"
      >
        <span>{{ formatDate(row.time) }}</span>
        <span class="table__type">
          <span class="dot" :class="`dot--${typeTone(row.type)}`" />
          {{ typeLabel(row.type) }}
        </span>
        <span class="table__what" :title="rowSubject(row)">{{ rowSubject(row) }}</span>
        <span>{{ row.username || "system" }}</span>
        <span :class="resultTone(row) === 'bad' ? 'table__result--bad' : ''">
          {{ resultLabel(row) }}
        </span>
        <span class="table__chev">›</span>
      </div>
      <div v-if="filteredRows.length > pageSize" class="table__pager">
        Showing {{ pagedRows.length }} of {{ filteredRows.length }}
        <q-btn
          flat
          dense
          no-caps
          label="Load more"
          :disable="pagedRows.length >= filteredRows.length"
          @click="page = page + 1"
        />
      </div>
    </div>

    <q-dialog v-model="drawerOpen" position="right" maximized>
      <div class="drawer">
        <header class="drawer__head">
          <h3>{{ rowSubject(activeRow!) }}</h3>
          <q-space />
          <q-btn flat dense round icon="close" @click="drawerOpen = false" />
        </header>
        <dl class="drawer__meta" v-if="activeRow">
          <div><dt>Time</dt><dd>{{ formatDate(activeRow.time) }}</dd></div>
          <div><dt>Type</dt><dd>{{ typeLabel(activeRow.type) }}</dd></div>
          <div><dt>By</dt><dd>{{ activeRow.username || "system" }}</dd></div>
          <div v-if="exitCode !== null"><dt>Exit code</dt><dd>{{ exitCode }}</dd></div>
        </dl>
        <section v-if="stdoutText" class="drawer__section">
          <h4>stdout</h4>
          <pre>{{ stdoutText }}</pre>
        </section>
        <section v-if="stderrText" class="drawer__section">
          <h4>stderr</h4>
          <pre>{{ stderrText }}</pre>
        </section>
        <section v-if="rawResults" class="drawer__section">
          <h4>raw output</h4>
          <pre>{{ rawResults }}</pre>
        </section>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { fetchAgentHistory } from "@/api/agents";

interface HistoryRow {
  id: number;
  type: string;
  time: string;
  username: string;
  command: string | null;
  results: string | null;
  script_name?: string | null;
  script_results?: { retcode?: number; stdout?: string; stderr?: string } | null;
}

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "script_run", label: "Scripts" },
  { value: "cmd_run", label: "Commands" },
  { value: "task_run", label: "Tasks" },
] as const;

const props = defineProps<{ agentId: string }>();

const rows = ref<HistoryRow[]>([]);
const loading = ref(true);
const errorMsg = ref("");
const search = ref("");
const typeFilter = ref<string>("all");
const page = ref(1);
const pageSize = 50;

const drawerOpen = ref(false);
const activeRow = ref<HistoryRow | null>(null);

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  page.value = 1;
  try {
    const data = (await fetchAgentHistory(props.agentId)) as HistoryRow[] | undefined;
    rows.value = Array.isArray(data) ? data : [];
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value
    .filter((r) => typeFilter.value === "all" || r.type === typeFilter.value)
    .filter((r) => {
      if (!q) return true;
      const blob =
        `${r.script_name ?? ""} ${r.command ?? ""} ${r.username ?? ""}`.toLowerCase();
      return blob.includes(q);
    })
    .slice(0, 500);
});

const pagedRows = computed(() => filteredRows.value.slice(0, page.value * pageSize));

function openRow(r: HistoryRow) {
  activeRow.value = r;
  drawerOpen.value = true;
}

const exitCode = computed<number | null>(() => {
  const c = activeRow.value?.script_results?.retcode;
  return c === undefined ? null : c;
});
const stdoutText = computed<string>(
  () => activeRow.value?.script_results?.stdout ?? "",
);
const stderrText = computed<string>(
  () => activeRow.value?.script_results?.stderr ?? "",
);
const rawResults = computed<string>(() => activeRow.value?.results ?? "");

function rowSubject(r: HistoryRow): string {
  if (!r) return "";
  if (r.type === "script_run") return r.script_name || "(script)";
  if (r.type === "task_run") return r.script_name || "(task)";
  if (r.type === "cmd_run") return r.command || "(command)";
  return r.command || r.script_name || "—";
}

function resultLabel(r: HistoryRow): string {
  const code = r.script_results?.retcode;
  if (code === undefined || code === null) {
    return r.results ? "ok" : "—";
  }
  return code === 0 ? "success" : `exit ${code}`;
}

function resultTone(r: HistoryRow): "ok" | "bad" | "neutral" {
  const code = r.script_results?.retcode;
  if (code === 0) return "ok";
  if (code === undefined || code === null) return "neutral";
  return "bad";
}

function typeLabel(t: string): string {
  return (
    {
      script_run: "Script",
      task_run: "Task",
      cmd_run: "Command",
    } as Record<string, string>
  )[t] ?? t;
}

function typeTone(t: string): "script" | "task" | "cmd" | "neutral" {
  if (t === "script_run") return "script";
  if (t === "task_run") return "task";
  if (t === "cmd_run") return "cmd";
  return "neutral";
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

watch(() => props.agentId, load);
onMounted(load);
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  &__filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  &__search { min-width: 220px; }
}

.filter {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-fg-primary);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  &:hover { background: var(--color-bg-page); }
  &--active {
    background: var(--color-accent-bg, #e8f1ff);
    border-color: var(--color-accent, #2569d6);
    color: var(--color-accent, #2569d6);
    font-weight: 600;
  }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;
  &--error { color: var(--color-state-negative-fg, #a40e26); }
}

.table {
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;

  &__head, &__row {
    display: grid;
    grid-template-columns: 170px 110px minmax(0, 2fr) 130px 110px 24px;
    gap: 12px;
    padding: 8px 14px;
    font-size: 13px;
    align-items: center;
  }
  &__head {
    color: var(--color-fg-secondary);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
  &__type { display: flex; align-items: center; gap: 8px; }
  &__what {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__chev { color: var(--color-fg-secondary); }
  &__result--bad { color: var(--color-state-negative-fg, #a40e26); }
  &__pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 10px 14px;
    font-size: 12px;
    color: var(--color-fg-secondary);
    background: var(--color-bg-page);
    border-top: 1px solid var(--color-border-subtle);
  }
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-fg-secondary);
  &--script { background: var(--color-accent, #2569d6); }
  &--task { background: #8a5cd6; }
  &--cmd { background: #14a085; }
}

.drawer {
  width: min(720px, 100vw);
  height: 100%;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  gap: 14px;

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    h3 { margin: 0; font-size: 16px; font-weight: 600; }
  }
  &__meta {
    margin: 0;
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 4px 12px;
    font-size: 12px;
    div { display: contents; }
    dt { color: var(--color-fg-secondary); margin: 0; }
    dd { margin: 0; }
  }
  &__section {
    h4 {
      margin: 0 0 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-fg-secondary);
      font-weight: 600;
    }
    pre {
      margin: 0;
      max-height: 50vh;
      overflow: auto;
      background: var(--color-bg-page);
      border: 1px solid var(--color-border-subtle);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
    }
  }
}
</style>
