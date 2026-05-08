<!--
  AlertTemplatesTab — Phase P templates library.

  Table of AlertTemplate via GET /alerts/templates/. Mirrors Phase O
  Library tab chrome (search, filter, density, bulk dropdown).

  Bulk: enable/disable/duplicate (POST new template with same payload)/delete.
  Row click → /alerts/templates/:id detail page.
  "New template" → creates a stub via POST then opens its detail page.
-->
<template>
  <div class="atl">
    <header class="atl__bar">
      <q-btn
        unelevated color="primary"
        icon="add" label="New template" no-caps
        :loading="creating"
        @click="onAdd"
      />

      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search templates…"
        class="atl__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="atl__filter">
        <q-list dense style="min-width: 220px;">
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
          <q-item clickable @click="filter.appliedOnly = !filter.appliedOnly">
            <q-item-section>In use only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.appliedOnly" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown
        v-if="selected.length"
        flat no-caps icon="checklist"
        :label="`Bulk (${selected.length})`"
        class="atl__bulk"
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
          <q-item clickable @click="bulk('delete')" class="atl__bulk-danger">
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

    <div v-if="loading && rows.length === 0" class="atl__state">Loading templates…</div>
    <div v-else-if="errorMsg" class="atl__state atl__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="atl__state atl__state--empty">
      <q-icon name="tune" size="36px" />
      <p v-if="rows.length === 0">No alert templates yet. Create one to control which channels (email, SMS, dashboard) fire for which severities.</p>
      <p v-else>No templates match your filters.</p>
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
      :class="`atl__tbl atl__tbl--${density}`"
      :rows-per-page-options="[25, 50, 100, 200]"
      @row-click="(_, r) => goToDetail(r)"
    >
      <template #body-cell-name="p">
        <q-td :props="p">
          <div class="atl__name">{{ p.row.name }}</div>
          <div v-if="p.row.default_template" class="atl__sub">Default template</div>
        </q-td>
      </template>
      <template #body-cell-status="p">
        <q-td :props="p" auto-width>
          <span class="chip" :class="p.row.is_active ? 'chip--positive' : ''">
            {{ p.row.is_active ? "Active" : "Inactive" }}
          </span>
        </q-td>
      </template>
      <template #body-cell-channels="p">
        <q-td :props="p" auto-width>
          <span v-if="hasEmail(p.row)" class="chip chip--info atl__chip-pad">
            <q-icon name="mail" size="11px" />&nbsp;Email
          </span>
          <span v-if="hasSms(p.row)" class="chip chip--info atl__chip-pad">
            <q-icon name="sms" size="11px" />&nbsp;SMS
          </span>
          <span v-if="hasDashboard(p.row)" class="chip chip--info atl__chip-pad">
            <q-icon name="dashboard" size="11px" />&nbsp;Dashboard
          </span>
        </q-td>
      </template>
      <template #body-cell-severities="p">
        <q-td :props="p" auto-width>
          <SeverityChip
            v-for="s in mergedSeverities(p.row)"
            :key="s"
            :severity="s"
            class="atl__chip-pad"
          />
        </q-td>
      </template>
      <template #body-cell-applied="p">
        <q-td :props="p" auto-width>
          <span class="chip">{{ p.row.applied_count ?? 0 }} target(s)</span>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="confirmDelete">
      <q-card>
        <q-card-section>
          <div class="text-h6">Delete {{ selected.length }} template(s)?</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          Templates already applied to clients/sites/agents will be detached.
          This cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="negative" label="Delete" @click="confirmDeleteOK" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Notify } from "quasar";

import {
  fetchAlertTemplates,
  saveAlertTemplate,
  addAlertTemplate,
  deleteAlertTemplate,
  getAlertTemplate,
} from "@/api/alerts";

import SeverityChip from "@/components/alerts/SeverityChip.vue";

defineExpose({ reload });

const router = useRouter();

const loading = ref(false);
const creating = ref(false);
const errorMsg = ref("");
const rows = ref([]);
const selected = ref([]);
const search = ref("");
const density = ref("compact");
const confirmDelete = ref(false);

const filter = ref({
  active: null,    // null | true | false
  appliedOnly: false,
});

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.active === true)  parts.push("Active");
  if (filter.value.active === false) parts.push("Inactive");
  if (filter.value.appliedOnly)      parts.push("In use");
  return parts.length ? parts.join(" · ") : "Filter";
});

const columns = [
  { name: "name",       label: "Name",       field: "name",      align: "left" },
  { name: "status",     label: "Status",     field: "is_active", align: "left", style: "width:120px;" },
  { name: "channels",   label: "Channels",   field: () => null,  align: "left", style: "width:280px;" },
  { name: "severities", label: "Severities", field: () => null,  align: "left", style: "width:240px;" },
  { name: "applied",    label: "Applied to", field: "applied_count", align: "left", style: "width:140px;" },
];

const pagination = ref({ rowsPerPage: 50 });

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (filter.value.active === true && !r.is_active) return false;
    if (filter.value.active === false && r.is_active) return false;
    if (filter.value.appliedOnly && !(r.applied_count > 0)) return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

function hasEmail(t) {
  return (
    !!(t.email_recipients && t.email_recipients.length) ||
    t.agent_always_email || t.check_always_email || t.task_always_email ||
    (t.check_email_alert_severity && t.check_email_alert_severity.length) ||
    (t.task_email_alert_severity  && t.task_email_alert_severity.length)
  );
}
function hasSms(t) {
  return (
    !!(t.text_recipients && t.text_recipients.length) ||
    t.agent_always_text || t.check_always_text || t.task_always_text ||
    (t.check_text_alert_severity && t.check_text_alert_severity.length) ||
    (t.task_text_alert_severity  && t.task_text_alert_severity.length)
  );
}
function hasDashboard(t) {
  return (
    t.agent_always_alert || t.check_always_alert || t.task_always_alert ||
    (t.check_dashboard_alert_severity && t.check_dashboard_alert_severity.length) ||
    (t.task_dashboard_alert_severity  && t.task_dashboard_alert_severity.length)
  );
}

function mergedSeverities(t) {
  const set = new Set();
  for (const arr of [
    t.check_email_alert_severity, t.check_text_alert_severity, t.check_dashboard_alert_severity,
    t.task_email_alert_severity,  t.task_text_alert_severity,  t.task_dashboard_alert_severity,
  ]) {
    if (Array.isArray(arr)) for (const s of arr) set.add(s);
  }
  // Stable order: error → warning → info
  return ["error", "warning", "info"].filter((s) => set.has(s));
}

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await fetchAlertTemplates();
    const ids = new Set(rows.value.map((r) => r.id));
    selected.value = selected.value.filter((r) => ids.has(r.id));
  } catch (err) {
    errorMsg.value = err?.response?.data?.detail || err?.message || "Failed to load templates";
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

function goToDetail(row) {
  router.push({ name: "AlertTemplateDetail", params: { id: row.id } });
}

async function onAdd() {
  // Create a stub template, then open the detail page for editing.
  // Mirrors PolicyAddDialog pattern (Phase O) — kept as a single click
  // since the form is rich enough that a separate add dialog would
  // duplicate every field.
  creating.value = true;
  try {
    const stub = {
      name: `New template ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      is_active: true,
    };
    await addAlertTemplate(stub);
    // backend POST returns "ok" not the new object; fetch list, find newest
    const list = await fetchAlertTemplates();
    rows.value = list;
    const created = list
      .filter((t) => t.name === stub.name)
      .sort((a, b) => b.id - a.id)[0];
    if (created) {
      router.push({ name: "AlertTemplateDetail", params: { id: created.id } });
    } else {
      Notify.create({ type: "warning", message: "Template created — open it manually" });
    }
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Failed to create template" });
  } finally {
    creating.value = false;
  }
}

async function bulk(action) {
  const ids = selected.value.map((r) => r.id);
  if (!ids.length) return;
  try {
    if (action === "enable" || action === "disable") {
      const is_active = action === "enable";
      await Promise.all(ids.map((id) => saveAlertTemplate(id, { is_active })));
      Notify.create({ type: "positive", message: `${action}d ${ids.length} template(s)`, timeout: 1800 });
    } else if (action === "duplicate") {
      const tpls = await Promise.all(ids.map((id) => getAlertTemplate(id)));
      await Promise.all(
        tpls.map((t) =>
          addAlertTemplate({ ...stripReadOnly(t), name: `${t.name} (copy)` }),
        ),
      );
      Notify.create({ type: "positive", message: `Duplicated ${ids.length} template(s)`, timeout: 1800 });
    } else if (action === "delete") {
      confirmDelete.value = true;
      return;   // wait for confirmation dialog
    }
    selected.value = [];
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || `Bulk ${action} failed` });
  }
}

async function confirmDeleteOK() {
  const ids = selected.value.map((r) => r.id);
  confirmDelete.value = false;
  try {
    await Promise.all(ids.map((id) => deleteAlertTemplate(id)));
    Notify.create({ type: "positive", message: `Deleted ${ids.length} template(s)`, timeout: 1800 });
    selected.value = [];
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Delete failed" });
  }
}
</script>

<style lang="scss" scoped>
.atl {
  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 12px;
    flex-wrap: wrap;
  }
  &__search { min-width: 280px; flex: 1 1 320px; max-width: 480px; }

  &__state {
    margin: 24px auto;
    padding: 32px 16px;
    text-align: center;
    color: var(--color-fg-secondary);
    max-width: 480px;
    p { margin: 12px 0 0; }
    &--error { color: var(--color-state-negative-fg, #b21f1f); }
  }

  &__tbl :deep(thead th) {
    font-weight: 600;
    color: var(--color-fg-secondary);
    background: var(--color-bg-surface);
  }
  &__tbl--compact :deep(td) { padding: 4px 8px; height: 28px; }
  &__tbl--comfortable :deep(td) { padding: 8px 12px; height: 40px; }

  &__name { color: var(--color-fg-primary); font-weight: 500; }
  &__sub  { color: var(--color-fg-tertiary); font-size: 11px; }
  &__chip-pad { margin-right: 4px; }

  &__bulk-danger { color: var(--color-state-negative-fg, #b21f1f); }
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
  border: 1px solid var(--color-stroke-divider);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
}
</style>
