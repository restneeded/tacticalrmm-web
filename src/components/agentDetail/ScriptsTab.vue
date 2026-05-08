<!--
  ScriptsTab — script execution history + (Phase L) Run-script button.

  Source: GET /agents/<id>/history/  filtered to type === "script_run".

  Phase L: the bar's left side gains the "Run script" entry point that
  Phase J intentionally deferred. Tapping it opens the shared
  ScriptPickerModal, which on confirm dispatches /agents/<id>/runscript/
  and refreshes the history table.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="play_arrow"
        label="Run script"
        @click="pickerOpen = true"
      />
      <div class="ad-tab__hint" v-if="lastDispatch">
        Last dispatch: <b>{{ lastDispatch.scriptName }}</b> · {{ lastDispatch.relTime }}
      </div>
      <q-space />
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Search script, user…"
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

    <div v-if="loading && rows.length === 0" class="state">Loading runs…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="state state--error">
      Couldn't load history: {{ errorMsg }}
    </div>
    <div v-else-if="filtered.length === 0" class="state">
      No script runs recorded for this agent.
    </div>
    <div v-else class="table">
      <div class="table__head">
        <span>Time</span>
        <span>Script</span>
        <span>By</span>
        <span>Exit</span>
        <span>Preview</span>
        <span></span>
      </div>
      <div
        v-for="row in pagedRows"
        :key="row.id"
        class="table__row"
        @click="openRow(row)"
      >
        <span>{{ formatDate(row.time) }}</span>
        <span class="table__name" :title="row.script_name || ''">
          {{ row.script_name || "(unknown)" }}
        </span>
        <span>{{ row.username || "system" }}</span>
        <span :class="resultTone(row) === 'bad' ? 'table__exit--bad' : ''">
          {{ exitLabel(row) }}
        </span>
        <span class="table__preview" :title="preview(row)">{{ preview(row) }}</span>
        <span class="table__chev">›</span>
      </div>
      <div v-if="filtered.length > pageSize" class="table__pager">
        Showing {{ pagedRows.length }} of {{ filtered.length }}
        <q-btn
          flat
          dense
          no-caps
          label="Load more"
          :disable="pagedRows.length >= filtered.length"
          @click="page = page + 1"
        />
      </div>
    </div>

    <RunOutputDrawer
      v-model="drawerOpen"
      :title="activeRow?.script_name || 'Script run'"
      :meta="activeMeta"
      :stdout="activeRow?.script_results?.stdout || ''"
      :stderr="activeRow?.script_results?.stderr || ''"
      :exit-code="activeRow?.script_results?.retcode"
    />

    <!-- Phase L: shared script picker. -->
    <ScriptPickerModal
      v-model="pickerOpen"
      context="agent"
      :agent-label="agentId"
      :dispatching="dispatching"
      @confirm="onPickerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchAgentHistory } from "@/api/agents";
import { runScriptOnAgent } from "@/api/scripts";
import RunOutputDrawer  from "@/components/scripts/RunOutputDrawer.vue";
import ScriptPickerModal, { type PickerSelection } from "@/components/scripts/ScriptPickerModal.vue";

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

const props = defineProps<{ agentId: string }>();

const $q = useQuasar();

const rows = ref<HistoryRow[]>([]);
const loading = ref(true);
const errorMsg = ref("");
const search = ref("");
const page = ref(1);
const pageSize = 50;

const drawerOpen = ref(false);
const activeRow  = ref<HistoryRow | null>(null);

const pickerOpen  = ref(false);
const dispatching = ref(false);
const lastDispatch = ref<{ scriptName: string; relTime: string; at: number } | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  page.value = 1;
  try {
    const data = (await fetchAgentHistory(props.agentId)) as HistoryRow[] | undefined;
    const all = Array.isArray(data) ? data : [];
    rows.value = all.filter((r) => r.type === "script_run");
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) =>
    `${r.script_name ?? ""} ${r.username ?? ""}`.toLowerCase().includes(q),
  );
});

const pagedRows = computed(() => filtered.value.slice(0, page.value * pageSize));

function openRow(r: HistoryRow) {
  activeRow.value = r;
  drawerOpen.value = true;
}

const activeMeta = computed(() => {
  const r = activeRow.value; if (!r) return [];
  return [
    { k: "When", v: formatDate(r.time) },
    { k: "By",   v: r.username || "system" },
    { k: "Exit", v: exitLabel(r) },
  ];
});

function exitLabel(r: HistoryRow): string {
  const code = r.script_results?.retcode;
  if (code === undefined || code === null) return "—";
  return String(code);
}
function resultTone(r: HistoryRow): "ok" | "bad" | "neutral" {
  const code = r.script_results?.retcode;
  if (code === 0) return "ok";
  if (code === undefined || code === null) return "neutral";
  return "bad";
}
function preview(r: HistoryRow): string {
  const text = r.script_results?.stdout || r.script_results?.stderr || r.results || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  return d || e?.message || "request failed";
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
function relTime(at: number): string {
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 5)    return "just now";
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

async function onPickerConfirm(sel: PickerSelection) {
  dispatching.value = true;
  try {
    await runScriptOnAgent(props.agentId, {
      script: sel.script.id,
      output: "wait",
      args: sel.args,
      env_vars: sel.env_vars,
      timeout: sel.timeout,
      run_as_user: sel.run_as_user,
    });
    pickerOpen.value = false;
    lastDispatch.value = { scriptName: sel.script.name, relTime: relTime(Date.now()), at: Date.now() };
    $q.notify({ type: "positive", message: `Dispatched "${sel.script.name}"`, position: "top" });
    // Pull the new run into history. The run is synchronous-ish via NATS;
    // give it a beat then refresh.
    setTimeout(() => void load(), 1500);
    // Light polling for the next 60s in case the run is slow.
    if (pollTimer) clearInterval(pollTimer);
    let ticks = 0;
    pollTimer = setInterval(() => {
      ticks += 1;
      void load();
      if (ticks >= 12 && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }, 5000);
  } catch (err) {
    $q.notify({ type: "negative", message: extractMessage(err), position: "top" });
  } finally {
    dispatching.value = false;
  }
}

// keep the "x time ago" label fresh
let labelTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void load();
  labelTimer = setInterval(() => {
    if (lastDispatch.value) lastDispatch.value.relTime = relTime(lastDispatch.value.at);
  }, 30_000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (labelTimer) clearInterval(labelTimer);
});

watch(() => props.agentId, load);
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
  &__hint {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
  &__search { min-width: 240px; }
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
    grid-template-columns: 170px minmax(0, 2fr) 130px 70px minmax(0, 2.2fr) 24px;
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
  &__name, &__preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__preview { color: var(--color-fg-secondary); font-size: 12px; }
  &__chev { color: var(--color-fg-secondary); }
  &__exit--bad { color: var(--color-state-negative-fg, #a40e26); }
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
</style>
