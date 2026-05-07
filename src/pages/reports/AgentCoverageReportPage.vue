<template>
  <ReportPageShell
    title="Agent Coverage"
    icon="computer"
    lede="Per-agent managed-app coverage and compliance status."
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
        :rows-per-page-options="[25, 50, 100]"
        class="report-table"
      />
    </template>
    <q-inner-loading :showing="loading" />
  </ReportPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { errMsg } from "@/utils/errMsg";

import {
  type AgentCoverageResponse,
  csvUrl,
  getAgentCoverage,
  type ReportFiltersInput,
} from "@/api/reports";
import ReportPageShell from "@/components/reports/ReportPageShell.vue";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards.vue";
import { useReportFilters } from "@/composables/useReportFilters";

const { filters, cache, freshnessLabel } = useReportFilters();
const data = ref<AgentCoverageResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const csvHref = computed(() => csvUrl("agent-coverage", filters.value));

const summaryCards = computed(() => {
  if (!data.value) return [];
  const s = data.value.summary;
  return [
    { label: "Total agents", value: s.total_agents, tone: "info" as const },
    { label: "Fully compliant", value: s.agents_fully_compliant,
      tone: "good" as const },
    { label: "Partial", value: s.agents_partial,
      tone: s.agents_partial > 0 ? "warn" as const : undefined },
    { label: "Uncovered", value: s.agents_uncovered,
      tone: s.agents_uncovered > 0 ? "warn" as const : undefined,
      hint: `${s.managed_apps_total} managed apps total` },
  ];
});

const cols = [
  { name: "hostname", label: "Hostname", field: "hostname", align: "left" as const, sortable: true },
  { name: "client_name", label: "Client", field: "client_name", align: "left" as const, sortable: true },
  { name: "site_name", label: "Site", field: "site_name", align: "left" as const, sortable: true },
  { name: "covered_count", label: "Covered",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    field: (r: any) => `${r.covered_count} / ${r.managed_apps_total}`,
    align: "right" as const },
  { name: "up_to_date_count", label: "Up-to-date", field: "up_to_date_count",
    align: "right" as const, sortable: true },
  { name: "outdated_count", label: "Outdated", field: "outdated_count",
    align: "right" as const, sortable: true },
];

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getAgentCoverage(filters.value);
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
</style>
