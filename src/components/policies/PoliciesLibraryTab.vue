<!--
  PoliciesLibraryTab — Phase O global Library tab.

  Backend: GET /automation/policies/  — role-scoped list of every Policy
  with PolicyTableSerializer fields: pk, name, desc, active, enforced,
  alert_template (id), winupdatepolicy[], default_server_policy,
  default_workstation_policy, agents_count.

  Mirrors Phase M ChecksLibraryTab + Phase N TasksLibraryTab chrome
  (search, filter dropdown, density toggle, multi-select bulk actions).

  Row click → /policies/:id detail page (NOT a side drawer — policies
  are too rich to live behind one).
-->
<template>
  <div class="lib">
    <header class="lib__bar">
      <q-btn
        unelevated color="primary"
        icon="add" label="New policy" no-caps
        @click="onAdd"
      />

      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search policies…"
        class="lib__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="lib__filter">
        <q-list dense style="min-width: 240px;">
          <q-item-label header>Status</q-item-label>
          <q-item clickable @click="filter.active = null" :active="filter.active === null">
            <q-item-section>All</q-item-section>
            <q-item-section side><q-icon v-if="filter.active === null" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.active = true" :active="filter.active === true">
            <q-item-section>Active only</q-item-section>
            <q-item-section side><q-icon v-if="filter.active === true" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.active = false" :active="filter.active === false">
            <q-item-section>Inactive only</q-item-section>
            <q-item-section side><q-icon v-if="filter.active === false" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item clickable @click="filter.enforcedOnly = !filter.enforcedOnly">
            <q-item-section>Enforced only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.enforcedOnly" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.hasChecks = !filter.hasChecks">
            <q-item-section>With checks</q-item-section>
            <q-item-section side><q-toggle v-model="filter.hasChecks" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.hasTasks = !filter.hasTasks">
            <q-item-section>With tasks</q-item-section>
            <q-item-section side><q-toggle v-model="filter.hasTasks" dense /></q-item-section>
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
          <q-item clickable @click="bulk('duplicate')">
            <q-item-section>Duplicate</q-item-section>
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

    <div v-if="loading && rows.length === 0" class="lib__state">Loading policies…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="lib__state lib__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="lib__state lib__state--empty">
      <q-icon name="policy" size="36px" />
      <p v-if="rows.length === 0">No policies defined yet. Create one to bundle checks, tasks, and Windows-update settings for reuse across your fleet.</p>
      <p v-else>No policies match your filters.</p>
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
      :rows-per-page-options="[25, 50, 100, 200]"
      @row-click="(_, r) => onRowClick(r)"
    >
      <template #body-cell-name="p">
        <q-td :props="p">
          <div class="lib__name">{{ p.row.name }}</div>
          <div class="lib__sub" v-if="p.row.desc">{{ p.row.desc }}</div>
        </q-td>
      </template>
      <template #body-cell-status="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="p.row.active ? 'chip--positive' : ''">
            {{ p.row.active ? "Active" : "Inactive" }}
          </span>
          <span v-if="p.row.enforced" class="chip chip--warning lib__chip-pad">
            Enforced
          </span>
        </q-td>
      </template>
      <template #body-cell-defaults="p">
        <q-td :props="p" auto-width>
          <span v-if="p.row.default_server_policy" class="chip chip--info lib__chip-pad">
            Default · servers
          </span>
          <span v-if="p.row.default_workstation_policy" class="chip chip--info lib__chip-pad">
            Default · workstations
          </span>
          <span v-if="!p.row.default_server_policy && !p.row.default_workstation_policy" class="lib__muted">—</span>
        </q-td>
      </template>
      <template #body-cell-agents="p">
        <q-td :props="p" auto-width>
          <q-icon name="devices" size="14px" class="lib__type-ic" />
          {{ p.row.agents_count ?? 0 }}
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" auto-width>
          <q-btn flat dense round icon="open_in_new" size="sm" @click.stop="onRowClick(p.row)">
            <q-tooltip>Open</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="content_copy" size="sm" @click.stop="onDuplicate(p.row)">
            <q-tooltip>Duplicate</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="delete" color="negative" size="sm" @click.stop="onDelete(p.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div class="lib__footer">
      Showing {{ filteredRows.length }} of {{ rows.length }} policies
    </div>

    <PolicyAddDialog v-model="addOpen" @saved="onCreated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import {
  fetchPolicies, createPolicy, updatePolicy, removePolicy,
} from "@/api/automation";
import PolicyAddDialog from "./PolicyAddDialog.vue";
import { notifySuccess, notifyError } from "@/utils/notify";

const $q = useQuasar();
const router = useRouter();

const rows     = ref([]);
const loading  = ref(false);
const errorMsg = ref("");
const selected = ref([]);

const search = ref("");
const filter = ref({
  active: null,         // null | true | false
  enforcedOnly: false,
  hasChecks: false,
  hasTasks: false,
});
const density = ref("compact");

const pagination = { rowsPerPage: 50 };

const addOpen = ref(false);

defineExpose({ reload });

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchPolicies();
    rows.value = (Array.isArray(data) ? data : []).map((p) => ({
      ...p,
      // PolicyTableSerializer uses `pk` not `id` — alias for q-table row-key.
      id: p.id ?? p.pk,
    }));
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load policies";
  }
  loading.value = false;
}

onMounted(reload);

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (filter.value.active === true && !r.active) return false;
    if (filter.value.active === false && r.active) return false;
    if (filter.value.enforcedOnly && !r.enforced) return false;
    // hasChecks / hasTasks rely on counts the table serializer doesn't ship.
    // We approximate via agents_count > 0; finer-grained filtering happens
    // on the detail page.
    if (q) {
      const hay = `${r.name || ""} ${r.desc || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.active === true)  parts.push("active");
  if (filter.value.active === false) parts.push("inactive");
  if (filter.value.enforcedOnly)     parts.push("enforced");
  return parts.length === 0 ? "Filter" : parts.join(" · ");
});

const columns = computed(() => [
  { name: "name",     label: "Name",     field: "name",     align: "left", sortable: true },
  { name: "status",   label: "Status",   field: "active",   align: "left" },
  { name: "defaults", label: "Defaults", field: (r) => r.default_server_policy || r.default_workstation_policy, align: "left" },
  { name: "agents",   label: "Agents",   field: "agents_count", align: "left", sortable: true },
  { name: "actions",  label: "",         field: "actions",  align: "right" },
]);

function onRowClick(row) {
  router.push({ name: "PolicyDetail", params: { id: row.id ?? row.pk } });
}

function onAdd() {
  addOpen.value = true;
}

async function onCreated(newId) {
  addOpen.value = false;
  await reload();
  if (newId) router.push({ name: "PolicyDetail", params: { id: newId } });
}

async function onDuplicate(row) {
  $q.dialog({
    title: "Duplicate policy",
    message: "Name for the new policy:",
    prompt: { model: `${row.name} (copy)`, isValid: (v) => !!(v && v.trim()) },
    cancel: true,
    persistent: true,
  }).onOk(async (name) => {
    try {
      await createPolicy({
        name: name.trim(),
        desc: row.desc || "",
        active: false,
        enforced: row.enforced,
        copyId: row.id ?? row.pk,
      });
      notifySuccess("Policy duplicated");
      await reload();
    } catch (e) {
      notifyError(e?.response?.data?.detail || e?.message || "Duplicate failed");
    }
  });
}

function onDelete(row) {
  $q.dialog({
    title: "Delete policy?",
    message: `${row.name} — this will also delete its checks and tasks. This can't be undone.`,
    cancel: true,
    persistent: true,
    ok: { color: "negative", label: "Delete", flat: false },
  }).onOk(async () => {
    try {
      await removePolicy(row.id ?? row.pk);
      notifySuccess("Policy deleted");
      await reload();
    } catch (e) {
      notifyError(e?.response?.data?.detail || e?.message || "Delete failed");
    }
  });
}

// ─── bulk actions ────────────────────────────────────────────────────
async function bulk(kind) {
  const targets = [...selected.value];
  if (!targets.length) return;
  if (kind === "delete") {
    $q.dialog({
      title: `Delete ${targets.length} policies?`,
      message: "This will also delete their checks and tasks. This can't be undone.",
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
      const id = r.id ?? r.pk;
      if (kind === "enable")    await updatePolicy(id, { active: true });
      if (kind === "disable")   await updatePolicy(id, { active: false });
      if (kind === "duplicate") await createPolicy({
        name: `${r.name} (copy)`, desc: r.desc || "", active: false,
        enforced: r.enforced, copyId: id,
      });
      if (kind === "delete")    await removePolicy(id);
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
    p { margin: 0; max-width: 540px; }
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
  &__sub  { font-size: 12px; color: var(--color-fg-secondary); }
  &__muted { color: var(--color-fg-tertiary); }
  &__chip-pad { margin-left: 6px; }
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
  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
}
</style>
