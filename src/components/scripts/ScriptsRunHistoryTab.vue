<!--
  ScriptsRunHistoryTab — fleet-wide script run history.
  Backend: GET /agents/scripthistory/  (existing — agents/views.py
  ScriptRunHistory). Supports start, end, limit, scriptname.

  Click a row → side drawer with full stdout/stderr.
-->
<template>
  <div class="hist">
    <header class="hist__bar">
      <q-input v-model="search" dense outlined clearable placeholder="Filter…"
               class="hist__search">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-select
        v-model="statusFilter"
        dense outlined map-options emit-value
        :options="STATUS_OPTIONS"
        label="Status"
        class="hist__select"
      />
      <q-input v-model="scriptFilter" dense outlined clearable placeholder="Script name" class="hist__select" />
      <q-input v-model="agentFilter"  dense outlined clearable placeholder="Agent / hostname" class="hist__select" />
      <q-input v-model="userFilter"   dense outlined clearable placeholder="User" class="hist__select hist__select--sm" />
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="hist__state">Loading runs…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="hist__state hist__state--error">
      Couldn't load run history: {{ errorMsg }}
    </div>
    <div v-else-if="filtered.length === 0" class="hist__state">
      No script runs match.
    </div>
    <div v-else class="hist__table">
      <div class="hist__head">
        <span>Time</span>
        <span>Script</span>
        <span>Agent</span>
        <span>By</span>
        <span>Exit</span>
        <span>Preview</span>
        <span></span>
      </div>
      <div
        v-for="row in pagedRows"
        :key="row.id"
        class="hist__row"
        @click="openRow(row)"
      >
        <span :title="row.time">{{ formatDate(row.time) }}</span>
        <span class="hist__name" :title="row.script_name || ''">{{ row.script_name || "(unknown)" }}</span>
        <span class="hist__name" :title="row.agent_id || ''">{{ row.agent_hostname || row.agent_id || "—" }}</span>
        <span>{{ row.username || "system" }}</span>
        <span :class="resultTone(row) === 'bad' ? 'hist__bad' : ''">{{ exitLabel(row) }}</span>
        <span class="hist__preview" :title="preview(row)">{{ preview(row) }}</span>
        <span class="hist__chev">›</span>
      </div>
      <div v-if="filtered.length > pageSize" class="hist__pager">
        Showing {{ pagedRows.length }} of {{ filtered.length }}
        <q-btn
          flat dense no-caps label="Load more"
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
    >
      <template #actions>
        <q-btn v-if="activeRow" flat dense no-caps icon="replay" label="Re-run on same agent" @click="rerun" />
        <q-btn v-if="activeRow?.script" flat dense no-caps icon="open_in_new" label="View script" @click="viewScript" />
      </template>
    </RunOutputDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { useRouter } from "vue-router";
import { fetchScriptRunHistory, runScriptOnAgent } from "@/api/scripts";
import RunOutputDrawer from "./RunOutputDrawer.vue";

interface RunRow {
  id: number;
  time: string;
  username: string | null;
  script: number | null;
  script_name?: string | null;
  agent: number | null;
  agent_id?: string | null;
  agent_hostname?: string | null;
  script_results?: { retcode?: number; stdout?: string; stderr?: string; execution_time?: string } | null;
}

const STATUS_OPTIONS = [
  { value: "all",    label: "All" },
  { value: "ok",     label: "Success (exit 0)" },
  { value: "fail",   label: "Failed (non-zero)" },
  { value: "running",label: "Running / unknown" },
];

const $q = useQuasar();
const router = useRouter();

const rows         = ref<RunRow[]>([]);
const loading      = ref(true);
const errorMsg     = ref("");
const search       = ref("");
const scriptFilter = ref("");
const agentFilter  = ref("");
const userFilter   = ref("");
const statusFilter = ref("all");
const page         = ref(1);
const pageSize     = 80;

const drawerOpen = ref(false);
const activeRow  = ref<RunRow | null>(null);

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  page.value = 1;
  try {
    const data = await fetchScriptRunHistory({ limit: 1000 });
    rows.value = Array.isArray(data) ? data as RunRow[] : [];
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const filtered = computed<RunRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  const sn = scriptFilter.value.trim().toLowerCase();
  const ag = agentFilter.value.trim().toLowerCase();
  const us = userFilter.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (q) {
      const hay = `${r.script_name || ""} ${r.agent_hostname || r.agent_id || ""} ${r.username || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (sn && !(r.script_name || "").toLowerCase().includes(sn)) return false;
    if (ag && !(`${r.agent_hostname || ""} ${r.agent_id || ""}`).toLowerCase().includes(ag)) return false;
    if (us && !(r.username || "").toLowerCase().includes(us)) return false;
    if (statusFilter.value !== "all") {
      const code = r.script_results?.retcode;
      const tone = code === 0 ? "ok" : (code === undefined || code === null ? "running" : "fail");
      if (statusFilter.value !== tone) return false;
    }
    return true;
  });
});

const pagedRows = computed(() => filtered.value.slice(0, page.value * pageSize));

function openRow(r: RunRow) { activeRow.value = r; drawerOpen.value = true; }

const activeMeta = computed(() => {
  const r = activeRow.value; if (!r) return [];
  return [
    { k: "When",  v: formatDate(r.time) },
    { k: "By",    v: r.username || "system" },
    { k: "Exit",  v: exitLabel(r) },
    { k: "Agent", v: r.agent_hostname || r.agent_id || "—" },
  ];
});

function exitLabel(r: RunRow): string {
  const code = r.script_results?.retcode;
  return code === undefined || code === null ? "—" : String(code);
}
function resultTone(r: RunRow): "ok" | "bad" | "neutral" {
  const code = r.script_results?.retcode;
  if (code === 0) return "ok";
  if (code === undefined || code === null) return "neutral";
  return "bad";
}
function preview(r: RunRow): string {
  const text = r.script_results?.stdout || r.script_results?.stderr || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  return d || e?.message || "request failed";
}

async function rerun() {
  const r = activeRow.value;
  if (!r || !r.agent_id || !r.script) return;
  try {
    await runScriptOnAgent(r.agent_id, {
      script: r.script,
      output: "wait",
      args: [],
      run_as_user: false,
      env_vars: [],
      timeout: 90,
    });
    $q.notify({ type: "positive", message: "Re-run dispatched", position: "top" });
    drawerOpen.value = false;
    setTimeout(() => void reload(), 1500);
  } catch (err) {
    $q.notify({ type: "negative", message: extractMessage(err), position: "top" });
  }
}

function viewScript() {
  const r = activeRow.value;
  if (!r?.script) return;
  drawerOpen.value = false;
  void router.push({ name: "ScriptDetail", params: { id: String(r.script) } });
}

watch([scriptFilter, agentFilter, userFilter, statusFilter, search], () => { page.value = 1; });

onMounted(reload);
defineExpose({ reload });
</script>

<style lang="scss" scoped>
.hist {
  display: flex; flex-direction: column; gap: 12px;

  &__bar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  &__search { min-width: 200px; flex: 1 0 200px; max-width: 360px; }
  &__select { min-width: 160px; }
  &__select--sm { min-width: 120px; }

  &__state {
    color: var(--color-fg-secondary); padding: 24px; text-align: center;
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__table {
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-bg-surface);
    overflow: hidden;
  }
  &__head, &__row {
    display: grid;
    grid-template-columns: 170px minmax(0, 1.6fr) minmax(0, 1.4fr) 120px 70px minmax(0, 2fr) 24px;
    gap: 12px; padding: 8px 14px; font-size: 13px; align-items: center;
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
  &__name, &__preview {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  &__preview { color: var(--color-fg-secondary); font-size: 12px; }
  &__chev { color: var(--color-fg-secondary); }
  &__bad  { color: var(--color-state-negative-fg, #a40e26); font-weight: 600; }
  &__pager {
    display: flex; align-items: center; justify-content: flex-end; gap: 12px;
    padding: 10px 14px; font-size: 12px; color: var(--color-fg-secondary);
    background: var(--color-bg-page);
    border-top: 1px solid var(--color-border-subtle);
  }
}
</style>
