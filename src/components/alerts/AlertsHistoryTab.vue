<!--
  AlertsHistoryTab — Phase P read-only audit trail.

  Backend GetAddAlerts.patch only filters resolved=False when
  resolvedFilter is FALSY (a quirk in the existing endpoint), so we
  fetch the role-scoped list with severityFilter+timeFilter and keep
  resolved=true rows on the client side. Same for non-resolved if a
  user wants to see *everything*.
-->
<template>
  <div class="alh">
    <header class="alh__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search resolved alerts…"
        class="alh__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="alh__filter">
        <q-list dense style="min-width: 240px;">
          <q-item-label header>Severity</q-item-label>
          <q-item v-for="s in severities" :key="s.value" clickable @click="toggleSeverity(s.value)">
            <q-item-section><SeverityChip :severity="s.value" :label="s.label" /></q-item-section>
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

          <q-item-label header>Time window</q-item-label>
          <q-item v-for="t in timeWindows" :key="t.value" clickable @click="filter.days = t.value">
            <q-item-section>{{ t.label }}</q-item-section>
            <q-item-section side>
              <q-icon v-if="filter.days === t.value" name="check" />
            </q-item-section>
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

    <div v-if="loading && rows.length === 0" class="alh__state">Loading history…</div>
    <div v-else-if="errorMsg" class="alh__state alh__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="alh__state alh__state--empty">
      <q-icon name="history" size="36px" />
      <p v-if="rows.length === 0">No resolved alerts in the selected window.</p>
      <p v-else>No alerts match your filters.</p>
    </div>

    <q-table
      v-else
      :rows="filteredRows"
      :columns="columns"
      row-key="id"
      :pagination="pagination"
      flat dense
      :class="`alh__tbl alh__tbl--${density}`"
      :rows-per-page-options="[25, 50, 100, 200]"
    >
      <template #body-cell-severity="p">
        <q-td :props="p" auto-width><SeverityChip :severity="p.row.severity" /></q-td>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p" auto-width>
          <span class="alh__type">{{ typeLabel(p.row.alert_type) }}</span>
        </q-td>
      </template>
      <template #body-cell-target="p">
        <q-td :props="p">
          <a v-if="p.row.agent_id" :href="`/devices/${p.row.agent_id}`" class="alh__link">
            {{ p.row.hostname || p.row.agent_id }}
          </a>
          <span v-else>{{ p.row.hostname || "—" }}</span>
          <div v-if="p.row.client" class="alh__sub">{{ p.row.client }}<span v-if="p.row.site"> · {{ p.row.site }}</span></div>
        </q-td>
      </template>
      <template #body-cell-message="p">
        <q-td :props="p"><div class="alh__msg">{{ p.row.message || "—" }}</div></q-td>
      </template>
      <template #body-cell-fired="p">
        <q-td :props="p" auto-width>{{ formatTime(p.row.alert_time) }}</q-td>
      </template>
      <template #body-cell-resolved="p">
        <q-td :props="p" auto-width>{{ formatTime(p.row.resolved_on) }}</q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";

import { fetchAlerts } from "@/api/alerts";
import SeverityChip from "@/components/alerts/SeverityChip.vue";

defineExpose({ reload });

const loading = ref(false);
const errorMsg = ref("");
const rows = ref([]);
const search = ref("");
const density = ref("compact");

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
  { value: 7,  label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const filter = ref({
  severities: ["error", "warning", "info"],
  sources: [],
  days: 30,
});

function toggleSeverity(s) {
  const i = filter.value.severities.indexOf(s);
  if (i >= 0) filter.value.severities.splice(i, 1); else filter.value.severities.push(s);
}
function toggleSource(s) {
  const i = filter.value.sources.indexOf(s);
  if (i >= 0) filter.value.sources.splice(i, 1); else filter.value.sources.push(s);
}

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.severities.length < 3) parts.push(`${filter.value.severities.length} severities`);
  if (filter.value.sources.length) parts.push(`${filter.value.sources.length} source(s)`);
  parts.push(`${filter.value.days}d`);
  return parts.join(" · ") || "Filter";
});

const columns = [
  { name: "severity", label: "Severity", field: "severity", align: "left", style: "width:96px;" },
  { name: "type",     label: "Source",   field: "alert_type", align: "left", style: "width:120px;" },
  { name: "target",   label: "Target",   field: "hostname", align: "left" },
  { name: "message",  label: "Message",  field: "message",  align: "left" },
  { name: "fired",    label: "Fired",    field: "alert_time", align: "left", style: "width:170px;" },
  { name: "resolved", label: "Resolved", field: "resolved_on", align: "left", style: "width:170px;" },
];

const pagination = ref({ rowsPerPage: 50 });

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value
    .filter((r) => r.resolved)
    .filter((r) => filter.value.severities.includes(r.severity))
    .filter((r) => !filter.value.sources.length || filter.value.sources.includes(r.alert_type))
    .filter((r) => {
      if (!q) return true;
      const blob = `${r.message || ""} ${r.hostname || ""} ${r.client || ""} ${r.site || ""}`.toLowerCase();
      return blob.includes(q);
    })
    // newest first
    .sort((a, b) => (b.resolved_on || b.alert_time || "").localeCompare(a.resolved_on || a.alert_time || ""));
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

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await fetchAlerts({
      timeFilter: filter.value.days,
      severityFilter: ["error", "warning", "info"],
    });
  } catch (err) {
    errorMsg.value = err?.response?.data?.detail || err?.message || "Failed to load history";
  } finally {
    loading.value = false;
  }
}

watch(() => filter.value.days, reload);

onMounted(reload);
</script>

<style lang="scss" scoped>
.alh {
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

  &__type { color: var(--color-fg-secondary); font-size: 12px; text-transform: capitalize; }
  &__msg  { color: var(--color-fg-primary); }
  &__sub  { color: var(--color-fg-tertiary); font-size: 11px; }
  &__link { color: var(--color-brand-rest); text-decoration: none; &:hover { text-decoration: underline; } }
}
</style>
