<template>
  <ReportPageShell
    title="Outdated Apps"
    icon="warning"
    lede="Agents grouped by how many out-of-date managed apps they have."
    :filters="filters"
    :clients="cache.clients"
    :sites="cache.sites"
    :csv-href="csvHref"
    :freshness="freshnessLabel()"
    :error="error"
    @update:filters="onFiltersChange"
  >
    <template v-if="data">
      <ReportSummaryCards :cards="summaryCards" />

      <q-table
        :rows="data.agents"
        :columns="cols"
        row-key="agent_id"
        flat bordered dense
        :rows-per-page-options="[20, 50, 100]"
        class="report-table"
      >
        <template #body-cell-expand="props">
          <q-td :props="props">
            <q-btn
              :icon="expanded[props.row.agent_id] ? 'expand_less' : 'expand_more'"
              dense flat round
              :aria-label="`Toggle ${props.row.hostname} details`"
              @click="toggle(props.row.agent_id)"
            />
          </q-td>
        </template>
        <template #body="props">
          <q-tr :props="props">
            <q-td v-for="col in cols" :key="col.name" :props="props">
              <template v-if="col.name === 'expand'">
                <q-btn
                  :icon="expanded[props.row.agent_id] ? 'expand_less' : 'expand_more'"
                  dense flat round
                  :aria-label="`Toggle ${props.row.hostname} details`"
                  @click="toggle(props.row.agent_id)"
                />
              </template>
              <template v-else>{{ valueOf(col, props.row) }}</template>
            </q-td>
          </q-tr>
          <q-tr v-if="expanded[props.row.agent_id]">
            <q-td :colspan="cols.length" class="outdated-detail">
              <table class="outdated-detail__table">
                <thead>
                  <tr><th>App</th><th>Installed</th><th>Latest</th></tr>
                </thead>
                <tbody>
                  <tr v-for="app in props.row.outdated_apps" :key="app.app_id">
                    <td>{{ app.name }}</td>
                    <td>{{ app.installed_version }}</td>
                    <td>{{ app.latest_version }}</td>
                  </tr>
                </tbody>
              </table>
            </q-td>
          </q-tr>
        </template>
      </q-table>

      <q-banner v-if="!data.agents.length" class="report-empty">
        No agents are running out-of-date managed apps right now.
      </q-banner>
    </template>
    <q-inner-loading :showing="loading" />
  </ReportPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { errMsg } from "@/utils/errMsg";

import {
  csvUrl,
  getOutdatedApps,
  type OutdatedAppsResponse,
  type ReportFiltersInput,
} from "@/api/reports";
import ReportPageShell from "@/components/reports/ReportPageShell.vue";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards.vue";
import { useReportFilters } from "@/composables/useReportFilters";

const { filters, cache, freshnessLabel } = useReportFilters();
const data = ref<OutdatedAppsResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const expanded = ref<Record<string, boolean>>({});

const csvHref = computed(() => csvUrl("outdated-apps", filters.value));

const summaryCards = computed(() => {
  if (!data.value) return [];
  const s = data.value.summary;
  return [
    { label: "Total agents", value: s.total_agents, tone: "info" as const },
    {
      label: "Agents with outdated apps",
      value: s.agents_with_outdated,
      tone: s.agents_with_outdated === 0 ? "good" as const : "warn" as const,
      hint: histogramHint(s.histogram),
    },
  ];
});

function histogramHint(h: Record<string, number>): string {
  const keys = Object.keys(h).sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => `${k}: ${h[k]}`).join("  •  ");
}

const cols = [
  { name: "expand", label: "", field: "", align: "left" as const, style: "width:40px" },
  { name: "hostname", label: "Hostname", field: "hostname", align: "left" as const, sortable: true },
  { name: "client_name", label: "Client", field: "client_name", align: "left" as const, sortable: true },
  { name: "site_name", label: "Site", field: "site_name", align: "left" as const, sortable: true },
  { name: "outdated_count", label: "Outdated", field: "outdated_count",
    align: "right" as const, sortable: true },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function valueOf(col: any, row: any) {
  if (typeof col.field === "function") return col.field(row);
  return row[col.field];
}

function toggle(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getOutdatedApps(filters.value);
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
}

function onFiltersChange(v: ReportFiltersInput) {
  filters.value = v;
}

watch(filters, load, { deep: true });
onMounted(load);
</script>

<style lang="scss" scoped>
.report-table { background-color: var(--color-bg-surface); }
.report-empty { margin-top: 16px; }
.outdated-detail {
  background-color: var(--color-bg-canvas);
  padding: 12px 16px;
  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--intune-font-size-200);
    th, td {
      padding: 6px 12px;
      text-align: left;
      border-bottom: 1px solid var(--color-stroke-divider);
    }
    th {
      color: var(--color-fg-tertiary);
      font-weight: var(--intune-font-weight-medium);
    }
  }
}
</style>
