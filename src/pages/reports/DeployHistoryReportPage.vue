<template>
  <ReportPageShell
    title="Deploy History"
    icon="history"
    lede="Job-level rollup: success, partial, failed, and time-to-complete."
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
        :rows="data.jobs"
        :columns="cols"
        row-key="id"
        flat bordered dense
        :rows-per-page-options="[25, 50, 100]"
        class="report-table"
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-chip
              :color="statusColor(props.row.status)"
              :text-color="statusFg(props.row.status)"
              dense outline
            >
              {{ props.row.status }}
            </q-chip>
          </q-td>
        </template>
      </q-table>
    </template>
    <q-inner-loading :showing="loading" />
  </ReportPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { errMsg } from "@/utils/errMsg";

import {
  csvUrl,
  type DeployHistoryResponse,
  getDeployHistory,
  type ReportFiltersInput,
} from "@/api/reports";
import ReportPageShell from "@/components/reports/ReportPageShell.vue";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards.vue";
import { useReportFilters } from "@/composables/useReportFilters";

const { filters, cache, freshnessLabel } = useReportFilters();
const data = ref<DeployHistoryResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const csvHref = computed(() => csvUrl("deploy-history", filters.value));

function fmtAvg(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

const summaryCards = computed(() => {
  if (!data.value) return [];
  const s = data.value.summary;
  return [
    { label: "Total jobs", value: s.total_jobs, tone: "info" as const },
    { label: "Success rate", value: `${s.success_rate_pct}%`,
      tone: s.success_rate_pct >= 90 ? "good" as const :
            s.success_rate_pct >= 60 ? "warn" as const : "bad" as const,
      hint: `${s.succeeded} ok • ${s.partial} partial • ${s.failed} failed` },
    { label: "Awaiting completion", value: s.awaiting_completion,
      tone: s.awaiting_completion > 0 ? "info" as const : undefined },
    { label: "Avg completion", value: fmtAvg(s.avg_completion_seconds), tone: "info" as const },
  ];
});

const cols = [
  { name: "id", label: "#", field: "id", align: "right" as const, sortable: true },
  { name: "kind", label: "Kind", field: "kind", align: "left" as const },
  { name: "status", label: "Status", field: "status", align: "left" as const, sortable: true },
  { name: "package_name", label: "Package", field: "package_name", align: "left" as const },
  { name: "total_agents", label: "Agents", field: "total_agents", align: "right" as const },
  { name: "dispatched_count", label: "Dispatched", field: "dispatched_count", align: "right" as const },
  { name: "skipped_count", label: "Skipped", field: "skipped_count", align: "right" as const },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { name: "created_at", label: "Created", field: (r: any) =>
      r.created_at ? new Date(r.created_at).toLocaleString() : "—",
    align: "left" as const },
];

function statusColor(s: string): string {
  return ({ done: "positive", partial: "warning", failed: "negative",
            queued: "blue-grey", dispatching: "info", running: "info" } as Record<string, string>)[s] || "grey";
}
function statusFg(s: string): string {
  return s === "queued" ? "white" : "white";
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getDeployHistory(filters.value);
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
