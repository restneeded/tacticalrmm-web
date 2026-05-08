<!--
  ScriptsTab — read-only script execution history.

  Source: GET /agents/<id>/history/  filtered to type === "script_run".
  This is the same endpoint the History tab uses; we render a more
  script-focused view with the script name, who started it, and the
  exit-code/output preview, with a click-through drawer for full
  output.

  Phase J intentionally does NOT add a "Run script" button here; the
  full script-library + run flow ships in Phase L. When that lands the
  bar's left side gains the dispatch button — the table itself stays.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <div class="ad-tab__hint">
        Read-only for Phase J. Run-script flow ships with the script
        library rebuild (Phase L).
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

    <q-dialog v-model="drawerOpen" position="right" maximized>
      <div class="drawer">
        <header class="drawer__head">
          <h3>{{ activeRow?.script_name || "Script run" }}</h3>
          <q-space />
          <q-btn flat dense round icon="close" @click="drawerOpen = false" />
        </header>
        <dl class="drawer__meta" v-if="activeRow">
          <div><dt>When</dt><dd>{{ formatDate(activeRow.time) }}</dd></div>
          <div><dt>By</dt><dd>{{ activeRow.username || "system" }}</dd></div>
          <div><dt>Exit code</dt><dd>{{ exitLabel(activeRow) }}</dd></div>
        </dl>
        <section v-if="stdoutText" class="drawer__section">
          <h4>stdout</h4>
          <pre>{{ stdoutText }}</pre>
        </section>
        <section v-if="stderrText" class="drawer__section">
          <h4>stderr</h4>
          <pre>{{ stderrText }}</pre>
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

const props = defineProps<{ agentId: string }>();

const rows = ref<HistoryRow[]>([]);
const loading = ref(true);
const errorMsg = ref("");
const search = ref("");
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

const stdoutText = computed<string>(() => activeRow.value?.script_results?.stdout ?? "");
const stderrText = computed<string>(() => activeRow.value?.script_results?.stderr ?? "");

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
