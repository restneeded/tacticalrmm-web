<!--
  TasksLibraryTab — Phase N global Library tab.

  Backend: GET /tasks/  — role-scoped list of every AutomatedTask across
  every agent and every policy.

  Schema reminder (autotasks/models.py): tasks belong to either an Agent
  OR a Policy (not both). Each task has a JSON `actions` list and one of
  the TaskType values driving the Windows Task Scheduler trigger.

  This tab mirrors Phase M's ChecksLibraryTab — same chrome (search,
  filter, density), same row-click → side-drawer flow.
-->
<template>
  <div class="lib">
    <header class="lib__bar">
      <q-btn
        v-if="!hideAdd"
        unelevated color="primary"
        icon="add" label="Add task" no-caps
        @click="onAdd"
      />

      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search tasks…"
        class="lib__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="lib__filter">
        <q-list dense style="min-width: 240px;">
          <q-item-label header>Schedule type</q-item-label>
          <q-item clickable @click="filter.type = null" :active="!filter.type">
            <q-item-section>All types</q-item-section>
            <q-item-section side><q-icon v-if="!filter.type" name="check" /></q-item-section>
          </q-item>
          <q-item v-for="opt in TYPE_OPTIONS" :key="opt.value" clickable
                  @click="filter.type = opt.value" :active="filter.type === opt.value">
            <q-item-section>{{ opt.label }}</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === opt.value" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item-label header>Target</q-item-label>
          <q-item clickable @click="filter.target = 'all'" :active="filter.target === 'all'">
            <q-item-section>All targets</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'all'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.target = 'agent'" :active="filter.target === 'agent'">
            <q-item-section>Agent tasks</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'agent'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.target = 'policy'" :active="filter.target === 'policy'">
            <q-item-section>Policy tasks</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'policy'" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item clickable @click="filter.enabledOnly = !filter.enabledOnly">
            <q-item-section>Enabled only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.enabledOnly" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.failingOnly = !filter.failingOnly">
            <q-item-section>Failing only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.failingOnly" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown
        v-if="selected.length"
        flat no-caps icon="checklist"
        :label="`Bulk (${selected.length})`"
        class="lib__bulk"
      >
        <q-list dense>
          <q-item clickable @click="bulk('enable')">
            <q-item-section>Enable</q-item-section>
          </q-item>
          <q-item clickable @click="bulk('disable')">
            <q-item-section>Disable</q-item-section>
          </q-item>
          <q-item clickable @click="bulk('run')">
            <q-item-section>Run now</q-item-section>
          </q-item>
          <q-separator />
          <q-item clickable @click="bulk('delete')" class="lib__bulk-danger">
            <q-item-section>Delete…</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />

      <q-btn-toggle
        v-model="density"
        toggle-color="primary"
        flat
        :options="[
          { value: 'compact', icon: 'density_small', label: '' },
          { value: 'comfortable', icon: 'density_medium', label: '' },
        ]"
        dense no-caps
      />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="lib__state">Loading tasks…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="lib__state lib__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="lib__state lib__state--empty">
      <q-icon name="schedule" size="36px" />
      <p v-if="rows.length === 0">No automated tasks defined in the fleet yet.</p>
      <p v-else>No tasks match your filters.</p>
    </div>

    <q-table
      v-else
      v-model:selected="selected"
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      :pagination="pagination"
      flat dense
      selection="multiple"
      :class="`lib__tbl lib__tbl--${density}`"
      :rows-per-page-options="[25, 50, 100, 200, 500]"
      @row-click="(_, r) => onRowClick(r)"
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
          <div class="lib__name">{{ p.row.name || "(unnamed)" }}</div>
          <div class="lib__sub">{{ actionsSummary(p.row) }}</div>
        </q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-icon :name="TYPE_ICONS[p.row.task_type] || 'schedule'" size="14px" class="lib__type-ic" />
          {{ TYPE_LABEL_BRIEF[p.row.task_type] || p.row.task_type }}
        </q-td>
      </template>
      <template #body-cell-schedule="p">
        <q-td :props="p">
          <span class="lib__schedule">{{ p.row.schedule || formatSchedule(p.row) }}</span>
        </q-td>
      </template>
      <template #body-cell-target="p">
        <q-td :props="p">
          <PolicyChip
            v-if="p.row.policy"
            :policy-id="p.row.policy"
            :name="p.row.policy_name || ''"
          />
          <span v-else-if="p.row.agent">agent #{{ p.row.agent }}</span>
          <span v-else>—</span>
        </q-td>
      </template>
      <template #body-cell-last_run="p">
        <q-td :props="p">{{ formatRelative(p.row.task_result?.last_run) }}</q-td>
      </template>
      <template #body-cell-enabled="p">
        <q-td :props="p" auto-width>
          <q-toggle
            :model-value="!!p.row.enabled"
            dense
            @update:model-value="(v) => toggleEnabled(p.row, v)"
            @click.stop
          />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" auto-width>
          <q-btn flat dense round icon="edit" size="sm" @click.stop="onEdit(p.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="play_arrow" size="sm" @click.stop="runOne(p.row)">
            <q-tooltip>Run now</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="delete" color="negative" size="sm" @click.stop="onDelete(p.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div class="lib__footer">
      Showing {{ filteredRows.length }} of {{ rows.length }} tasks
    </div>

    <TaskEditor
      v-model="editorOpen"
      :task-id="editingId"
      :agent-id="addAgentId"
      :agent-label="addAgentLabel"
      @saved="onSaved"
      @ran="reload"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import {
  fetchTasks, removeTask, runTask, updateTask,
} from "@/api/tasks";
import TaskEditor from "./TaskEditor.vue";
import PolicyChip from "@/components/policies/PolicyChip.vue";
import { TASK_TYPE_OPTIONS, formatSchedule } from "./scheduleHelpers.js";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  // When mounted in a non-page context that already has its own "Add task"
  // button (e.g. agent detail), we hide ours.
  hideAdd: { type: Boolean, default: false },
  // Optional: prefill agent context for new tasks created from this tab.
  contextAgentId: { type: String, default: "" },
  contextAgentLabel: { type: String, default: "" },
});

const $q = useQuasar();

const TYPE_OPTIONS = TASK_TYPE_OPTIONS;
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
const TYPE_ICONS = {
  manual: "touch_app",
  runonce: "alarm",
  daily: "today",
  weekly: "view_week",
  monthly: "calendar_month",
  monthlydow: "calendar_month",
  checkfailure: "report_problem",
  onboarding: "rocket_launch",
};

const rows = ref([]);
const loading = ref(false);
const errorMsg = ref("");
const selected = ref([]);

const search = ref("");
const filter = ref({
  type: null,
  target: "all",
  enabledOnly: false,
  failingOnly: false,
});
const density = ref("compact");

const pagination = { rowsPerPage: 50 };

const editorOpen = ref(false);
const editingId  = ref(null);
const addAgentId = ref(props.contextAgentId);
const addAgentLabel = ref(props.contextAgentLabel);

defineExpose({ reload, openCreate });

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchTasks();
    rows.value = Array.isArray(data) ? data : [];
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load tasks";
  }
  loading.value = false;
}

onMounted(reload);

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (filter.value.type && r.task_type !== filter.value.type) return false;
    if (filter.value.target === "agent" && !r.agent) return false;
    if (filter.value.target === "policy" && !r.policy) return false;
    if (filter.value.enabledOnly && !r.enabled) return false;
    if (filter.value.failingOnly && r.task_result?.status !== "failing") return false;
    if (q) {
      const hay = `${r.name || ""} ${r.task_type || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.type) parts.push(TYPE_LABEL_BRIEF[filter.value.type] || filter.value.type);
  if (filter.value.target === "agent") parts.push("agents");
  if (filter.value.target === "policy") parts.push("policies");
  if (filter.value.enabledOnly) parts.push("enabled");
  if (filter.value.failingOnly) parts.push("failing");
  return parts.length === 0 ? "Filter" : parts.join(" · ");
});

const columns = computed(() => [
  { name: "status",   label: "Status",   field: "status",       align: "left" },
  { name: "name",     label: "Name",     field: "name",         align: "left", sortable: true },
  { name: "type",     label: "Type",     field: "task_type",    align: "left" },
  { name: "schedule", label: "Schedule", field: "schedule",     align: "left" },
  { name: "target",   label: "Target",   field: "agent",        align: "left" },
  { name: "last_run", label: "Last run", field: (r) => r.task_result?.last_run, align: "left", sortable: true },
  { name: "enabled",  label: "Enabled",  field: "enabled",      align: "left" },
  { name: "actions",  label: "",         field: "actions",      align: "right" },
]);

function actionsSummary(r) {
  const acts = Array.isArray(r.actions) ? r.actions : [];
  if (acts.length === 0) return "(no actions)";
  if (acts.length === 1) {
    const a = acts[0];
    return a.type === "cmd" ? `cmd: ${(a.command || "").slice(0, 60)}` : "script action";
  }
  return `${acts.length} actions`;
}

function statusLabel(r) {
  const s = r.task_result?.status;
  if (!s) return r.enabled ? "pending" : "disabled";
  return s;
}
function statusTone(r) {
  if (!r.enabled) return "neutral";
  const s = r.task_result?.status;
  if (s === "passing") return "positive";
  if (s === "failing") {
    return r.alert_severity === "error" ? "negative" : "warning";
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

// ─── row actions ─────────────────────────────────────────────────────
function onRowClick(row) {
  editingId.value = row.id;
  // We don't have the hostname on the row (TaskSerializer returns the agent
  // FK pk only). The editor is fine without it in edit mode — props.agentId
  // is only required when *creating* a task.
  addAgentId.value = props.contextAgentId;
  addAgentLabel.value = props.contextAgentLabel;
  editorOpen.value = true;
}
function onEdit(row) { onRowClick(row); }

function onAdd() { openCreate(); }
function openCreate() {
  editingId.value = null;
  addAgentId.value = props.contextAgentId;
  addAgentLabel.value = props.contextAgentLabel;
  editorOpen.value = true;
}

async function onSaved() {
  await reload();
}

function onDelete(row) {
  $q.dialog({
    title: "Delete task?",
    message: `${row.name} — this can't be undone.`,
    cancel: true,
    persistent: true,
    ok: { color: "negative", label: "Delete", flat: false },
  }).onOk(async () => {
    try {
      await removeTask(row.id);
      notifySuccess("Task deleted");
      await reload();
    } catch (e) {
      notifyError(e?.response?.data?.detail || e?.message || "Delete failed");
    }
  });
}

async function runOne(row) {
  try {
    const res = await runTask(row.id);
    notifySuccess(typeof res === "string" ? res : "Run dispatched");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Run failed");
  }
}

async function toggleEnabled(row, v) {
  try {
    await updateTask(row.id, { enabled: !!v });
    row.enabled = !!v;
    notifySuccess(v ? "Task enabled" : "Task disabled");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Update failed");
  }
}

// ─── bulk actions ────────────────────────────────────────────────────
async function bulk(kind) {
  const targets = [...selected.value];
  if (!targets.length) return;
  if (kind === "delete") {
    $q.dialog({
      title: `Delete ${targets.length} tasks?`,
      message: "This can't be undone.",
      cancel: true,
      persistent: true,
      ok: { color: "negative", label: "Delete", flat: false },
    }).onOk(async () => { await runBulk(targets, "delete"); });
    return;
  }
  await runBulk(targets, kind);
}

async function runBulk(targets, kind) {
  let ok = 0; let fail = 0;
  await Promise.allSettled(targets.map(async (r) => {
    try {
      if (kind === "enable")  await updateTask(r.id, { enabled: true });
      if (kind === "disable") await updateTask(r.id, { enabled: false });
      if (kind === "run")     await runTask(r.id);
      if (kind === "delete")  await removeTask(r.id);
      ok++;
    } catch { fail++; }
  }));
  if (ok)   notifySuccess(`${kind}: ${ok} succeeded`);
  if (fail) notifyError(`${kind}: ${fail} failed`);
  selected.value = [];
  await reload();
}
</script>

<style lang="scss" scoped>
.lib {
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

  &__bulk-danger :deep(.q-item__section) { color: var(--color-state-negative-fg, #a40e26); }

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
    p { margin: 0; }
  }

  &__tbl {
    background: var(--color-bg-surface);
    &--compact :deep(tbody td) { padding: 4px 10px; }
    &--comfortable :deep(tbody td) { padding: 8px 12px; }
    :deep(tbody tr) { cursor: pointer; }
  }
  &__type-ic {
    margin-right: 6px;
    color: var(--color-fg-secondary);
  }
  &__name { font-weight: 500; }
  &__sub { font-size: 12px; color: var(--color-fg-secondary); }
  &__schedule {
    font-family: var(--intune-font-mono, monospace);
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
  &__link {
    color: var(--color-link, #1c70d8);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  &__footer {
    color: var(--color-fg-secondary);
    font-size: 12px;
    padding: 6px 4px;
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
