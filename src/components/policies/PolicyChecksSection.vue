<!--
  PolicyChecksSection — embedded checks list for /policies/:id (Phase O).

  Reuses the Phase M CheckEditor with the new policyId/policyLabel props
  for both create and (already-supported) edit flows.

  Backend: GET /automation/policies/<id>/checks/  (alias of GetAddChecks
  with policy=<id>); writes go through POST /checks/ + PUT /checks/<id>/
  + DELETE /checks/<id>/.
-->
<template>
  <div class="sec">
    <header class="sec__bar">
      <q-btn
        unelevated color="primary"
        icon="add" label="Add check" no-caps
        @click="openCreate"
      />
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search checks…"
        class="sec__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="sec__state">Loading checks…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="sec__state sec__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="sec__state sec__state--empty">
      <q-icon name="checklist" size="32px" />
      <p v-if="rows.length === 0">No checks on this policy. Add one to monitor every agent it applies to.</p>
      <p v-else>No checks match your search.</p>
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
          <q-icon :name="TYPE_ICONS[p.row.check_type] || 'check_circle'" size="14px" class="sec__type-ic" />
          <span class="sec__name">{{ p.row.name || p.row.readable_desc || "(unnamed)" }}</span>
        </q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ TYPE_LABELS[p.row.check_type] || p.row.check_type }}</q-td>
      </template>
      <template #body-cell-detail="p">
        <q-td :props="p">{{ checkDetail(p.row) }}</q-td>
      </template>
      <template #body-cell-severity="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="`chip--${p.row.alert_severity || 'info'}`">
            {{ p.row.alert_severity || "info" }}
          </span>
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

    <CheckEditor
      v-model="editorOpen"
      :check-id="editingId"
      :policy-id="policyId"
      :policy-label="policyName"
      :initial-check-type="initialType"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchPolicyChecks } from "@/api/automation";
import { removeCheck } from "@/api/checks";
import CheckEditor from "@/components/checks/CheckEditor.vue";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  policyId:   { type: Number, required: true },
  policyName: { type: String, default: "" },
});
const emit = defineEmits(["count"]);

const $q = useQuasar();

const TYPE_ICONS = {
  diskspace: "storage",
  cpuload:   "memory",
  memory:    "memory",
  ping:      "wifi",
  winsvc:    "settings",
  script:    "code",
  eventlog:  "list_alt",
};
const TYPE_LABELS = {
  diskspace: "Disk space",
  cpuload:   "CPU load",
  memory:    "Memory",
  ping:      "Ping",
  winsvc:    "Windows service",
  script:    "Script",
  eventlog:  "Event log",
};

const rows     = ref([]);
const loading  = ref(false);
const errorMsg = ref("");
const search   = ref("");
const pagination = { rowsPerPage: 25 };

const editorOpen = ref(false);
const editingId  = ref(null);
const initialType = ref("diskspace");

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchPolicyChecks(props.policyId);
    rows.value = Array.isArray(data) ? data : [];
    emit("count", rows.value.length);
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load checks";
  }
  loading.value = false;
}

onMounted(reload);
watch(() => props.policyId, reload);

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) =>
    `${r.name || ""} ${r.readable_desc || ""} ${r.check_type || ""}`.toLowerCase().includes(q)
  );
});

const columns = computed(() => [
  { name: "name",     label: "Name",     field: "name",     align: "left", sortable: true },
  { name: "type",     label: "Type",     field: "check_type", align: "left" },
  { name: "detail",   label: "Detail",   field: (r) => r.readable_desc, align: "left" },
  { name: "severity", label: "Severity", field: "alert_severity", align: "left" },
  { name: "actions",  label: "",         field: "actions",  align: "right" },
]);

function checkDetail(r) {
  if (r.readable_desc) return r.readable_desc;
  if (r.check_type === "diskspace") return r.disk;
  if (r.check_type === "ping")      return r.ip;
  if (r.check_type === "winsvc")    return r.svc_display_name || r.svc_name;
  if (r.check_type === "script")    return r.script?.name || `script #${r.script}`;
  if (r.check_type === "eventlog")  return `${r.log_name} #${r.event_id}`;
  return "—";
}

function openCreate() {
  editingId.value = null;
  initialType.value = "diskspace";
  editorOpen.value = true;
}
function onEdit(row) {
  editingId.value = row.id;
  initialType.value = row.check_type || "diskspace";
  editorOpen.value = true;
}
async function onSaved() { await reload(); }

function onDelete(row) {
  $q.dialog({
    title: "Delete check?",
    message: `${row.name || row.readable_desc || row.check_type} — this can't be undone.`,
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
  &__type-ic {
    margin-right: 6px;
    color: var(--color-fg-secondary);
  }
  &__name { font-weight: 500; }
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
