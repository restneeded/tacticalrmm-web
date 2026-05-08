<!--
  AlertsActiveTab — Phase P unresolved-alerts dashboard.

  Backend: PATCH /alerts/ with filter body (resolvedFilter:false +
  severityFilter array). Mirrors Phase O Library tab chrome (search,
  filter dropdown, density toggle, bulk dropdown).

  Row click → AlertDrawer side drawer with full message + linked context
  + quick actions.

  Bulk actions: resolve, snooze (1d/3d/7d/custom), hide.
-->
<template>
  <div class="alt">
    <header class="alt__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search by host, message, client…"
        class="alt__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="alt__filter">
        <q-list dense style="min-width: 260px;">
          <q-item-label header>Severity</q-item-label>
          <q-item v-for="s in severities" :key="s.value" clickable @click="toggleSeverity(s.value)">
            <q-item-section><span class="alt__sev-row">
              <SeverityChip :severity="s.value" :label="s.label" />
            </span></q-item-section>
            <q-item-section side>
              <q-icon v-if="filter.severities.includes(s.value)" name="check" />
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <q-item-label header>Source</q-item-label>
          <q-item v-for="t in sourceTypes" :key="t.value" clickable @click="toggleSource(t.value)">
            <q-item-section>{{ t.label }}</q-item-section>
            <q-item-section side>
              <q-icon v-if="filter.sources.includes(t.value)" name="check" />
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <q-item-label header>Time</q-item-label>
          <q-item v-for="t in timeWindows" :key="t.value" clickable @click="filter.days = t.value">
            <q-item-section>{{ t.label }}</q-item-section>
            <q-item-section side>
              <q-icon v-if="filter.days === t.value" name="check" />
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <q-item clickable @click="filter.includeSnoozed = !filter.includeSnoozed">
            <q-item-section>Include snoozed</q-item-section>
            <q-item-section side><q-toggle v-model="filter.includeSnoozed" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.includeHidden = !filter.includeHidden">
            <q-item-section>Include hidden</q-item-section>
            <q-item-section side><q-toggle v-model="filter.includeHidden" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown
        v-if="selected.length"
        flat no-caps icon="checklist"
        :label="`Bulk (${selected.length})`"
        class="alt__bulk"
      >
        <q-list dense>
          <q-item clickable @click="bulkResolve">
            <q-item-section>Resolve</q-item-section>
          </q-item>
          <q-item-label header>Snooze</q-item-label>
          <q-item clickable @click="bulkSnooze(1)">
            <q-item-section>1 day</q-item-section>
          </q-item>
          <q-item clickable @click="bulkSnooze(3)">
            <q-item-section>3 days</q-item-section>
          </q-item>
          <q-item clickable @click="bulkSnooze(7)">
            <q-item-section>7 days</q-item-section>
          </q-item>
          <q-item clickable @click="bulkSnoozeCustom">
            <q-item-section>Custom…</q-item-section>
          </q-item>
          <q-separator />
          <q-item clickable @click="bulkHide">
            <q-item-section>Hide</q-item-section>
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

    <div v-if="loading && rows.length === 0" class="alt__state">Loading alerts…</div>
    <div v-else-if="errorMsg" class="alt__state alt__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="alt__state alt__state--empty">
      <q-icon name="check_circle" size="40px" color="positive" />
      <p v-if="rows.length === 0">All clear — no active alerts. Templates configured under the Templates tab decide who gets paged when something breaks.</p>
      <p v-else>No alerts match your filters.</p>
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
      :class="`alt__tbl alt__tbl--${density}`"
      :rows-per-page-options="[25, 50, 100, 200]"
      @row-click="(_, r) => openDrawer(r)"
    >
      <template #body-cell-severity="p">
        <q-td :props="p" auto-width>
          <SeverityChip :severity="p.row.severity" />
        </q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p" auto-width>
          <span class="alt__type">{{ typeLabel(p.row.alert_type) }}</span>
        </q-td>
      </template>
      <template #body-cell-target="p">
        <q-td :props="p">
          <a v-if="p.row.agent_id"
             :href="`/devices/${p.row.agent_id}`"
             class="alt__link"
             @click.stop>
            {{ p.row.hostname || p.row.agent_id }}
          </a>
          <span v-else class="alt__sub">{{ p.row.hostname || "—" }}</span>
          <div v-if="p.row.client" class="alt__sub">{{ p.row.client }}<span v-if="p.row.site"> · {{ p.row.site }}</span></div>
        </q-td>
      </template>
      <template #body-cell-message="p">
        <q-td :props="p">
          <div class="alt__msg">{{ p.row.message || "—" }}</div>
        </q-td>
      </template>
      <template #body-cell-fired="p">
        <q-td :props="p" auto-width>
          <div>{{ formatTime(p.row.alert_time) }}</div>
          <div class="alt__sub">{{ ageText(p.row.alert_time) }}</div>
        </q-td>
      </template>
      <template #body-cell-flags="p">
        <q-td :props="p" auto-width>
          <span v-if="p.row.snoozed" class="chip chip--info">Snoozed</span>
          <span v-if="p.row.hidden" class="chip">Hidden</span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" auto-width @click.stop>
          <q-btn flat dense size="sm" icon="check" @click.stop="resolveOne(p.row.id)">
            <q-tooltip>Resolve</q-tooltip>
          </q-btn>
          <q-btn flat dense size="sm" icon="snooze" @click.stop="snoozeOne(p.row.id)">
            <q-tooltip>Snooze 1 day</q-tooltip>
          </q-btn>
          <q-btn flat dense size="sm" icon="visibility_off" @click.stop="hideOne(p.row.id)">
            <q-tooltip>Hide</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <AlertDrawer
      v-model="drawerOpen"
      :alert="drawerAlert"
      @resolved="onDrawerAction('resolve', $event)"
      @snoozed="onDrawerAction('snooze', $event)"
      @hidden="onDrawerAction('hide', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { Notify, Dialog } from "quasar";

import {
  fetchAlerts,
  resolveAlert,
  snoozeAlert,
  hideAlert,
  bulkResolveAlerts,
  bulkSnoozeAlerts,
} from "@/api/alerts";

import SeverityChip from "@/components/alerts/SeverityChip.vue";
import AlertDrawer  from "@/components/alerts/AlertDrawer.vue";

const props = defineProps({
  agentFilter: { type: String, default: "" },   // optional preset for agent_id
});

const route = useRoute();

// Effective agent filter: explicit prop wins; otherwise honor ?agent=...
// from the URL so cross-page links (Phase J Agent Detail, dashboard
// tile) work without needing a wrapper component.
const effectiveAgent = computed(() =>
  props.agentFilter || (typeof route.query.agent === "string" ? route.query.agent : "")
);

defineExpose({ reload });

const loading = ref(false);
const errorMsg = ref("");
const rows = ref([]);
const selected = ref([]);
const density = ref("compact");
const search = ref("");

const drawerOpen = ref(false);
const drawerAlert = ref(null);

const severities = [
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];
const sourceTypes = [
  { value: "availability", label: "Availability (agent)" },
  { value: "check", label: "Check" },
  { value: "task", label: "Task" },
  { value: "custom", label: "Custom" },
];
const timeWindows = [
  { value: 0, label: "Any time" },
  { value: 1, label: "Last 24 hours" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
];

const filter = ref({
  severities: ["error", "warning", "info"],
  sources: [],
  days: 0,
  includeSnoozed: false,
  includeHidden: false,
});

function toggleSeverity(s) {
  const i = filter.value.severities.indexOf(s);
  if (i >= 0) filter.value.severities.splice(i, 1);
  else filter.value.severities.push(s);
}
function toggleSource(s) {
  const i = filter.value.sources.indexOf(s);
  if (i >= 0) filter.value.sources.splice(i, 1);
  else filter.value.sources.push(s);
}

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.severities.length < 3) parts.push(`${filter.value.severities.length} severities`);
  if (filter.value.sources.length) parts.push(`${filter.value.sources.length} source(s)`);
  if (filter.value.days) parts.push(`${filter.value.days}d`);
  if (filter.value.includeSnoozed) parts.push("snoozed");
  if (filter.value.includeHidden) parts.push("hidden");
  return parts.length ? parts.join(" · ") : "Filter";
});

const columns = [
  { name: "severity", label: "Severity",  field: "severity", align: "left", style: "width:96px;" },
  { name: "type",     label: "Source",    field: "alert_type", align: "left", style: "width:120px;" },
  { name: "target",   label: "Target",    field: "hostname", align: "left" },
  { name: "message",  label: "Message",   field: "message",  align: "left" },
  { name: "fired",    label: "Fired",     field: "alert_time", align: "left", style: "width:160px;" },
  { name: "flags",    label: "Status",    field: "snoozed",  align: "left", style: "width:120px;" },
  { name: "actions",  label: "",          field: () => null, align: "right", style: "width:140px;" },
];

const pagination = ref({ rowsPerPage: 50 });

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (!filter.value.severities.includes(r.severity)) return false;
    if (filter.value.sources.length && !filter.value.sources.includes(r.alert_type)) return false;
    if (!filter.value.includeSnoozed && r.snoozed) return false;
    if (!filter.value.includeHidden && r.hidden) return false;
    if (effectiveAgent.value && r.agent_id !== effectiveAgent.value) return false;
    if (q) {
      const blob = `${r.message || ""} ${r.hostname || ""} ${r.client || ""} ${r.site || ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
});

function typeLabel(t) {
  switch (t) {
    case "availability": return "Agent";
    case "check": return "Check";
    case "task": return "Task";
    default: return t || "—";
  }
}

function formatTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function ageText(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const body = {
      resolvedFilter: false,    // backend interprets falsy ⇒ Q(resolved=False)
      severityFilter: ["error", "warning", "info"],
    };
    if (filter.value.days > 0) body.timeFilter = filter.value.days;
    rows.value = await fetchAlerts(body);
    // de-select rows that disappeared
    const ids = new Set(rows.value.map((r) => r.id));
    selected.value = selected.value.filter((r) => ids.has(r.id));
  } catch (err) {
    errorMsg.value = err?.response?.data?.detail || err?.message || "Failed to load alerts";
  } finally {
    loading.value = false;
  }
}

watch(() => filter.value.days, reload);

onMounted(reload);

function openDrawer(row) {
  drawerAlert.value = row;
  drawerOpen.value = true;
}

async function resolveOne(id) {
  try {
    await resolveAlert(id);
    Notify.create({ type: "positive", message: "Alert resolved", timeout: 1500 });
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Failed to resolve" });
  }
}

async function snoozeOne(id, days = 1) {
  try {
    await snoozeAlert(id, days);
    Notify.create({ type: "positive", message: `Snoozed for ${days}d`, timeout: 1500 });
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Failed to snooze" });
  }
}

async function hideOne(id) {
  try {
    await hideAlert(id);
    Notify.create({ type: "positive", message: "Alert hidden", timeout: 1500 });
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Failed to hide" });
  }
}

async function bulkResolve() {
  const ids = selected.value.map((r) => r.id);
  if (!ids.length) return;
  try {
    await bulkResolveAlerts(ids);
    Notify.create({ type: "positive", message: `Resolved ${ids.length} alert(s)`, timeout: 1800 });
    selected.value = [];
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Bulk resolve failed" });
  }
}

async function bulkSnooze(days) {
  const ids = selected.value.map((r) => r.id);
  if (!ids.length) return;
  try {
    await bulkSnoozeAlerts(ids, days);
    Notify.create({ type: "positive", message: `Snoozed ${ids.length} alert(s) for ${days}d`, timeout: 1800 });
    selected.value = [];
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Bulk snooze failed" });
  }
}

function bulkSnoozeCustom() {
  Dialog.create({
    title: "Snooze alerts",
    message: "How many days?",
    prompt: { model: "1", type: "number" },
    cancel: true,
  }).onOk((val) => {
    const n = parseInt(val, 10);
    if (n > 0) bulkSnooze(n);
  });
}

async function bulkHide() {
  const ids = selected.value.map((r) => r.id);
  if (!ids.length) return;
  try {
    await Promise.all(ids.map((id) => hideAlert(id)));
    Notify.create({ type: "positive", message: `Hid ${ids.length} alert(s)`, timeout: 1800 });
    selected.value = [];
    await reload();
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Bulk hide failed" });
  }
}

async function onDrawerAction(kind, id) {
  if (kind === "resolve") await resolveOne(id);
  if (kind === "snooze")  await snoozeOne(id, 1);
  if (kind === "hide")    await hideOne(id);
  drawerOpen.value = false;
}
</script>

<style lang="scss" scoped>
.alt {
  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 12px;
    flex-wrap: wrap;
  }
  &__search { min-width: 280px; flex: 1 1 320px; max-width: 480px; }
  &__filter, &__bulk { padding: 0 4px; }

  &__sev-row { display: inline-flex; align-items: center; gap: 6px; }

  &__state {
    margin: 24px auto;
    padding: 32px 16px;
    text-align: center;
    color: var(--color-fg-secondary);
    max-width: 480px;
    p { margin: 12px 0 0; }
    &--error { color: var(--color-state-negative-fg, #b21f1f); }
    &--empty { color: var(--color-fg-secondary); }
  }

  &__tbl :deep(thead th) {
    font-weight: 600;
    color: var(--color-fg-secondary);
    background: var(--color-bg-surface);
  }
  &__tbl--compact :deep(td) { padding: 4px 8px; height: 28px; }
  &__tbl--comfortable :deep(td) { padding: 8px 12px; height: 40px; }

  &__type { color: var(--color-fg-secondary); font-size: 12px; text-transform: capitalize; }
  &__msg  { color: var(--color-fg-primary); }
  &__sub  { color: var(--color-fg-tertiary); font-size: 11px; }
  &__link { color: var(--color-brand-rest); text-decoration: none; &:hover { text-decoration: underline; } }
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

  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
}
</style>
