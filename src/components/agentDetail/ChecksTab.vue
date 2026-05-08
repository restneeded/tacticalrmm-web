<!--
  ChecksTab — Phase M agent-detail Checks tab.

  Slots into AgentDetailPage as the 9th tab. Lists the agent's checks with
  per-row actions (edit, delete, reset status). The "Add check" button
  opens the CheckEditor in create mode; clicking a row opens it in edit
  mode. The "Run all checks" button at the top fires the agent-level
  runchecks NATS verb (see api/checks.js#runAgentChecks docstring).
-->
<template>
  <section class="ct">
    <header class="ct__bar">
      <q-btn
        unelevated
        color="primary"
        icon="add"
        label="Add check"
        no-caps
        @click="onAdd"
      />
      <q-btn
        flat
        no-caps
        icon="play_arrow"
        label="Run all checks"
        :loading="running"
        @click="onRunAll"
      >
        <q-tooltip>
          Dispatches the runchecks NATS verb — agent runs all assigned checks once.
        </q-tooltip>
      </q-btn>
      <q-btn
        flat
        no-caps
        icon="restart_alt"
        label="Reset all status"
        :loading="resettingAll"
        @click="onResetAll"
      />
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="ct__state">Loading checks…</div>
    <div v-else-if="errorMsg" class="ct__state ct__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="rows.length === 0" class="ct__state ct__state--empty">
      <q-icon name="checklist" size="36px" />
      <p>No checks defined for this agent.</p>
      <q-btn unelevated color="primary" icon="add" label="Add check" no-caps @click="onAdd" />
    </div>

    <q-table
      v-else
      :rows="rows"
      :columns="columns"
      row-key="id"
      :pagination="pagination"
      flat
      dense
      class="ct__tbl"
      hide-bottom
      :rows-per-page-options="[0]"
    >
      <template #body-cell-status="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="`chip--${statusTone(p.row)}`">
            {{ statusLabel(p.row) }}
          </span>
        </q-td>
      </template>
      <template #body-cell-name="p">
        <q-td :props="p">
          <div class="ct__name">{{ p.row.name || p.row.readable_desc || "(unnamed)" }}</div>
          <div class="ct__desc">{{ p.row.readable_desc }}</div>
        </q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ TYPE_LABELS[p.row.check_type] || p.row.check_type }}</q-td>
      </template>
      <template #body-cell-severity="p">
        <q-td :props="p">{{ p.row.alert_severity || "—" }}</q-td>
      </template>
      <template #body-cell-last_run="p">
        <q-td :props="p">{{ formatRelative(p.row.check_result?.last_run) }}</q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" auto-width>
          <q-btn flat dense round icon="edit" size="sm" @click.stop="onEdit(p.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat dense round icon="restart_alt" size="sm"
            :disable="!p.row.check_result?.id"
            @click.stop="onResetOne(p.row)"
          >
            <q-tooltip>Reset status</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="delete" color="negative" size="sm" @click.stop="onDelete(p.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <CheckEditor
      v-model="editorOpen"
      :check-id="editingId"
      :agent-id="agentId"
      :agent-label="agentLabel"
      :initial-check-type="initialType"
      @saved="onSaved"
    />
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import {
  removeCheck,
  resetCheck,
  resetAllChecksStatus,
  runAgentChecks,
} from "@/api/checks";
import { fetchAgentChecks } from "@/api/agents";
import CheckEditor from "@/components/checks/CheckEditor.vue";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  agentId:    { type: String, required: true },
  agentLabel: { type: String, default: "" },
});

const $q = useQuasar();

const TYPE_LABELS = {
  diskspace: "Disk space",
  cpuload:   "CPU load",
  memory:    "Memory",
  ping:      "Ping",
  winsvc:    "Service",
  script:    "Script",
  eventlog:  "Event log",
};

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const running = ref(false);
const resettingAll = ref(false);

const editorOpen = ref(false);
const editingId  = ref(null);
const initialType = ref("diskspace");

const pagination = { rowsPerPage: 0 }; // show all

const columns = [
  { name: "status",   label: "Status",   field: "status",       align: "left" },
  { name: "name",     label: "Name",     field: "name",         align: "left" },
  { name: "type",     label: "Type",     field: "check_type",   align: "left" },
  { name: "severity", label: "Severity", field: "alert_severity", align: "left" },
  { name: "last_run", label: "Last run", field: (r) => r.check_result?.last_run, align: "left" },
  { name: "actions",  label: "",         field: "actions",      align: "right" },
];

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    // /agents/<id>/checks/ — agent-scoped list with check_result populated.
    const data = await fetchAgentChecks(props.agentId);
    rows.value = Array.isArray(data) ? data : [];
  } catch (e) {
    errorMsg.value =
      e?.response?.data?.detail || e?.message || "Couldn't load checks";
  }
  loading.value = false;
}

watch(() => props.agentId, () => { void reload(); });

onMounted(reload);

function onAdd() {
  editingId.value = null;
  initialType.value = "diskspace";
  editorOpen.value = true;
}

function onEdit(row) {
  editingId.value = row.id;
  editorOpen.value = true;
}

async function onSaved() {
  await reload();
}

function onDelete(row) {
  $q.dialog({
    title: "Delete check?",
    message: `${row.name || row.readable_desc} — this can't be undone.`,
    cancel: true,
    persistent: true,
    ok: { color: "negative", label: "Delete", flat: false },
  }).onOk(async () => {
    try {
      await removeCheck(row.id);
      notifySuccess("Check deleted");
      await reload();
    } catch (e) {
      notifyError(e?.response?.data?.detail || e?.message || "Delete failed");
    }
  });
}

async function onResetOne(row) {
  const rid = row.check_result?.id;
  if (!rid) return;
  try {
    await resetCheck(rid);
    notifySuccess("Status reset");
    await reload();
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Reset failed");
  }
}

async function onResetAll() {
  resettingAll.value = true;
  try {
    await resetAllChecksStatus(props.agentId);
    notifySuccess("All check statuses reset");
    await reload();
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Reset failed");
  }
  resettingAll.value = false;
}

async function onRunAll() {
  running.value = true;
  try {
    const msg = await runAgentChecks(props.agentId);
    notifySuccess(typeof msg === "string" ? msg : "Run dispatched");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Dispatch failed");
  }
  running.value = false;
}

function statusLabel(row) {
  const s = row.check_result?.status;
  if (!s) return "pending";
  return s;
}
function statusTone(row) {
  const s = row.check_result?.status;
  if (s === "passing") return "positive";
  if (s === "failing") {
    return row.check_result?.alert_severity === "error" ? "negative" : "warning";
  }
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
</script>

<style lang="scss" scoped>
.ct {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 0 0;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__state {
    padding: 28px 16px;
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
    &--empty { padding: 40px 16px; }
  }

  &__tbl {
    background: var(--color-bg-surface);
  }
  &__name { font-weight: 500; }
  &__desc {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);

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
