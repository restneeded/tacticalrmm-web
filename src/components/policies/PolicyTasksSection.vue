<!--
  PolicyTasksSection — embedded tasks list for /policies/:id (Phase O).

  Reuses Phase N's TaskEditor with the new policyId/policyLabel props
  and (now) policy-aware buildPayload.

  Backend: GET /automation/policies/<id>/tasks/ alias of GetAddAutoTasks
  with policy=<id>; writes go through POST /tasks/ + PUT /tasks/<id>/
  + DELETE /tasks/<id>/.
-->
<template>
  <div class="sec">
    <header class="sec__bar">
      <q-btn
        unelevated color="primary"
        icon="add" label="Add task" no-caps
        @click="openCreate"
      />
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search tasks…"
        class="sec__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="sec__state">Loading tasks…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="sec__state sec__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="sec__state sec__state--empty">
      <q-icon name="schedule" size="32px" />
      <p v-if="rows.length === 0">No tasks on this policy. Add one to schedule scripts or commands across every agent it applies to.</p>
      <p v-else>No tasks match your search.</p>
    </div>

    <q-table
      v-else
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      :pagination="pagination"
      flat dense
      class="sec__tbl"
      @row-click="(_, r) => onEdit(r)"
    >
      <template #body-cell-name="p">
        <q-td :props="p">
          <span class="sec__name">{{ p.row.name || "(unnamed)" }}</span>
          <div class="sec__sub">{{ actionsSummary(p.row) }}</div>
        </q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ TYPE_LABELS[p.row.task_type] || p.row.task_type }}</q-td>
      </template>
      <template #body-cell-severity="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="`chip--${p.row.alert_severity || 'info'}`">
            {{ p.row.alert_severity || "info" }}
          </span>
        </q-td>
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
          <q-btn flat dense round icon="delete" color="negative" size="sm" @click.stop="onDelete(p.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <TaskEditor
      v-model="editorOpen"
      :task-id="editingId"
      :policy-id="policyId"
      :policy-label="policyName"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchPolicyTasks } from "@/api/automation";
import { removeTask, updateTask } from "@/api/tasks";
import TaskEditor from "@/components/tasks/TaskEditor.vue";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  policyId:   { type: Number, required: true },
  policyName: { type: String, default: "" },
});
const emit = defineEmits(["count"]);

const $q = useQuasar();

const TYPE_LABELS = {
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

const rows     = ref([]);
const loading  = ref(false);
const errorMsg = ref("");
const search   = ref("");
const pagination = { rowsPerPage: 25 };

const editorOpen = ref(false);
const editingId  = ref(null);

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchPolicyTasks(props.policyId);
    rows.value = Array.isArray(data) ? data : [];
    emit("count", rows.value.length);
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load tasks";
  }
  loading.value = false;
}

onMounted(reload);
watch(() => props.policyId, reload);

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) =>
    `${r.name || ""} ${r.task_type || ""}`.toLowerCase().includes(q)
  );
});

const columns = computed(() => [
  { name: "name",     label: "Name",     field: "name",     align: "left", sortable: true },
  { name: "type",     label: "Type",     field: "task_type",align: "left" },
  { name: "severity", label: "Severity", field: "alert_severity", align: "left" },
  { name: "enabled",  label: "Enabled",  field: "enabled",  align: "left" },
  { name: "actions",  label: "",         field: "actions",  align: "right" },
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

function openCreate() {
  editingId.value = null;
  editorOpen.value = true;
}
function onEdit(row) {
  editingId.value = row.id;
  editorOpen.value = true;
}
async function onSaved() { await reload(); }

async function toggleEnabled(row, v) {
  try {
    await updateTask(row.id, { enabled: !!v });
    row.enabled = !!v;
    notifySuccess(v ? "Task enabled" : "Task disabled");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Update failed");
  }
}

function onDelete(row) {
  $q.dialog({
    title: "Delete task?",
    message: `${row.name || `task #${row.id}`} — this can't be undone.`,
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
</script>

<style lang="scss" scoped>
.sec {
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

  &__state {
    padding: 32px 16px;
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
    p { margin: 0; max-width: 540px; }
  }
  &__tbl {
    background: var(--color-bg-surface);
    :deep(tbody tr) { cursor: pointer; }
    :deep(tbody td) { padding: 6px 10px; }
  }
  &__name { font-weight: 500; }
  &__sub  { font-size: 12px; color: var(--color-fg-secondary); }
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
  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--error {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
