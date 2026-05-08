<!--
  ChecksLibraryTab — Phase M global Library tab.

  Backend: GET /checks/  (role-scoped list of every Check across every
  agent and every policy).

  TRMM checks are per-target (agent OR policy), not free-floating
  templates. To answer the brief's "templates" question we group rows
  client-side by `(check_type, name)` so duplicates across agents collapse
  into one row with a `targets` count. Toggling "Group by template" off
  shows the raw per-target list.

  Pattern: copies the Phase C/I table chrome (search, filter, density,
  column picker, saved views, bulk actions). Phase M scope keeps the
  filter set tight — type, severity, target, failing-only.
-->
<template>
  <div class="lib">
    <header class="lib__bar">
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Search checks…"
        class="lib__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="lib__filter">
        <q-list dense style="min-width: 260px;">
          <q-item-label header>Type</q-item-label>
          <q-item clickable @click="filter.type = null" :active="!filter.type">
            <q-item-section>All types</q-item-section>
            <q-item-section side><q-icon v-if="!filter.type" name="check" /></q-item-section>
          </q-item>
          <q-item v-for="opt in TYPE_OPTIONS" :key="opt.value" clickable @click="filter.type = opt.value" :active="filter.type === opt.value">
            <q-item-section>{{ opt.label }}</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === opt.value" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item-label header>Severity</q-item-label>
          <q-item clickable @click="filter.severity = null" :active="!filter.severity">
            <q-item-section>Any</q-item-section>
            <q-item-section side><q-icon v-if="!filter.severity" name="check" /></q-item-section>
          </q-item>
          <q-item v-for="opt in SEVERITY_OPTIONS" :key="opt.value" clickable @click="filter.severity = opt.value" :active="filter.severity === opt.value">
            <q-item-section>{{ opt.label }}</q-item-section>
            <q-item-section side><q-icon v-if="filter.severity === opt.value" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item-label header>Target</q-item-label>
          <q-item clickable @click="filter.target = 'all'" :active="filter.target === 'all'">
            <q-item-section>All targets</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'all'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.target = 'agent'" :active="filter.target === 'agent'">
            <q-item-section>Agent checks</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'agent'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.target = 'policy'" :active="filter.target === 'policy'">
            <q-item-section>Policy checks</q-item-section>
            <q-item-section side><q-icon v-if="filter.target === 'policy'" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item clickable @click="filter.failingOnly = !filter.failingOnly">
            <q-item-section>Failing only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.failingOnly" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.groupByTemplate = !filter.groupByTemplate">
            <q-item-section>Group by template</q-item-section>
            <q-item-section side><q-toggle v-model="filter.groupByTemplate" dense /></q-item-section>
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
        dense
        no-caps
      />
    </header>

    <div v-if="loading && rows.length === 0" class="lib__state">Loading checks…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="lib__state lib__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="lib__state lib__state--empty">
      <q-icon name="checklist" size="36px" />
      <p v-if="rows.length === 0">No checks defined in the fleet yet.</p>
      <p v-else>No checks match your filters.</p>
    </div>

    <q-table
      v-else
      :rows="filteredRows"
      :columns="columns"
      row-key="key"
      :pagination="pagination"
      flat
      dense
      :class="`lib__tbl lib__tbl--${density}`"
      :rows-per-page-options="[25, 50, 100, 200, 500]"
    >
      <template #body-cell-type="p">
        <q-td :props="p">
          <q-icon :name="TYPE_ICONS[p.row.check_type] || 'help'" size="16px" class="lib__type-ic" />
          {{ TYPE_LABELS[p.row.check_type] || p.row.check_type }}
        </q-td>
      </template>
      <template #body-cell-name="p">
        <q-td :props="p">
          <div class="lib__name">{{ p.row.name }}</div>
          <div v-if="p.row.detail" class="lib__desc">{{ p.row.detail }}</div>
        </q-td>
      </template>
      <template #body-cell-severity="p">
        <q-td :props="p">
          <span class="chip" :class="`chip--sev-${p.row.alert_severity || 'info'}`">
            {{ p.row.alert_severity || "—" }}
          </span>
        </q-td>
      </template>
      <template #body-cell-targets="p">
        <q-td :props="p" class="lib__targets">
          <PolicyChip
            v-if="!Array.isArray(p.row.raw) && p.row.raw && p.row.raw.policy"
            :policy-id="p.row.raw.policy"
            :name="p.row.raw.policy_name || ''"
          />
          <template v-else>
            {{ p.row.targets }}
            <span v-if="p.row.policy_count" class="lib__sub">
              ({{ p.row.policy_count }} policy)
            </span>
          </template>
        </q-td>
      </template>
      <template #body-cell-failing="p">
        <q-td :props="p">
          <span :class="p.row.failing > 0 ? 'lib__failing' : ''">
            {{ p.row.failing }}
          </span>
        </q-td>
      </template>
      <template #body-cell-last_run="p">
        <q-td :props="p">{{ formatRelative(p.row.last_run) }}</q-td>
      </template>
    </q-table>

    <div class="lib__footer">
      Showing {{ filteredRows.length }} of {{ rows.length }}
      <span v-if="filter.groupByTemplate"> templates</span>
      <span v-else> checks</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchChecks } from "@/api/checks";

const TYPE_LABELS = {
  diskspace: "Disk space",
  cpuload:   "CPU load",
  memory:    "Memory",
  ping:      "Ping",
  winsvc:    "Service",
  script:    "Script",
  eventlog:  "Event log",
};
const TYPE_ICONS = {
  diskspace: "storage",
  cpuload:   "memory",
  memory:    "memory",
  ping:      "network_check",
  winsvc:    "settings_suggest",
  script:    "code",
  eventlog:  "list_alt",
};
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const SEVERITY_OPTIONS = [
  { value: "info",    label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error",   label: "Error" },
];

const rawRows = ref([]);
const loading = ref(false);
const errorMsg = ref("");

const search = ref("");
const filter = ref({
  type: null,
  severity: null,
  target: "all",
  failingOnly: false,
  groupByTemplate: false,
});
const density = ref("compact");

const pagination = { rowsPerPage: 50 };

defineExpose({ reload });

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchChecks();
    rawRows.value = Array.isArray(data) ? data : [];
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load checks";
  }
  loading.value = false;
}
onMounted(reload);

// Per-target rows — flatten what the backend returns into a single row each.
const perTargetRows = computed(() =>
  rawRows.value.map((r) => ({
    key: `c${r.id}`,
    id: r.id,
    name: r.name || r.readable_desc || "(unnamed)",
    detail: r.readable_desc,
    check_type: r.check_type,
    alert_severity: r.alert_severity,
    targets: r.policy ? "policy" : "agent",
    policy_count: r.policy ? 1 : 0,
    failing: r.check_result?.status === "failing" ? 1 : 0,
    last_run: r.check_result?.last_run || null,
    raw: r,
  })),
);

// Template view: group by (check_type, name) — duplicates aggregate.
const templateRows = computed(() => {
  const map = new Map();
  for (const r of rawRows.value) {
    const key = `${r.check_type}::${(r.name || r.readable_desc || "").toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: r.name || r.readable_desc || "(unnamed)",
        detail: r.readable_desc,
        check_type: r.check_type,
        alert_severity: r.alert_severity,
        targets: 0,
        policy_count: 0,
        failing: 0,
        last_run: null,
        raw: [],
      });
    }
    const t = map.get(key);
    t.targets++;
    if (r.policy) t.policy_count++;
    if (r.check_result?.status === "failing") t.failing++;
    const lr = r.check_result?.last_run;
    if (lr && (!t.last_run || lr > t.last_run)) t.last_run = lr;
    t.raw.push(r);
  }
  return Array.from(map.values());
});

const filteredRows = computed(() => {
  const src = filter.value.groupByTemplate ? templateRows.value : perTargetRows.value;
  const q = search.value.trim().toLowerCase();
  return src.filter((r) => {
    if (filter.value.type && r.check_type !== filter.value.type) return false;
    if (filter.value.severity && r.alert_severity !== filter.value.severity) return false;
    if (filter.value.failingOnly && !r.failing) return false;
    if (filter.value.target !== "all") {
      if (filter.value.groupByTemplate) {
        // mixed grouping — accept if any of the underlying rows match
        const want = filter.value.target;
        const ok = r.raw.some((x) => (x.policy ? want === "policy" : want === "agent"));
        if (!ok) return false;
      } else {
        if (filter.value.target === "policy" && !r.raw.policy) return false;
        if (filter.value.target === "agent"  &&  r.raw.policy) return false;
      }
    }
    if (q) {
      const hay = `${r.name} ${r.detail || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.type) parts.push(TYPE_LABELS[filter.value.type]);
  if (filter.value.severity) parts.push(filter.value.severity);
  if (filter.value.failingOnly) parts.push("failing");
  if (filter.value.groupByTemplate) parts.push("templates");
  return parts.length === 0 ? "Filter" : parts.join(" · ");
});

const columns = computed(() => [
  { name: "type",     label: "Type",     field: "check_type",      align: "left" },
  { name: "name",     label: "Name",     field: "name",            align: "left", sortable: true },
  { name: "severity", label: "Severity", field: "alert_severity",  align: "left" },
  { name: "targets",  label: filter.value.groupByTemplate ? "Targets" : "Target", field: "targets", align: "left" },
  { name: "failing",  label: "Failing",  field: "failing",         align: "left", sortable: true },
  { name: "last_run", label: "Last run", field: "last_run",        align: "left", sortable: true },
]);

function formatRelative(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const rows = perTargetRows;
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
  &__search { min-width: 280px; flex: 1 1 280px; max-width: 480px; }

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
  }

  &__tbl {
    background: var(--color-bg-surface);
    &--compact :deep(tbody td) { padding: 4px 10px; }
    &--comfortable :deep(tbody td) { padding: 8px 12px; }
  }
  &__type-ic {
    margin-right: 6px;
    color: var(--color-fg-secondary);
  }
  &__name { font-weight: 500; }
  &__desc {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
  &__targets { white-space: nowrap; }
  &__sub {
    color: var(--color-fg-secondary);
    font-size: 11px;
    margin-left: 4px;
  }
  &__failing { color: var(--color-state-negative-fg, #a40e26); font-weight: 600; }
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

  &--sev-info {
    background: var(--color-bg-page);
    color: var(--color-fg-secondary);
  }
  &--sev-warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--sev-error {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
