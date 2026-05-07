<template>
  <ReportPageShell
    title="Patch Compliance"
    icon="verified"
    lede="Per-managed-app and fleet-wide compliance with auto-update policy."
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
        :rows="data.rows"
        :columns="cols"
        row-key="policy_id"
        flat
        bordered
        dense
        :rows-per-page-options="[20, 50, 100]"
        class="report-table"
      >
        <template #body-cell-compliance_pct="props">
          <q-td :props="props">
            <span :class="pctClass(props.row.compliance_pct)">
              {{ props.row.compliance_pct }}%
            </span>
          </q-td>
        </template>
      </q-table>

      <q-banner v-if="!data.rows.length" class="report-empty">
        No managed apps with auto-update enabled yet. Take over an app from
        the <router-link to="/software">Software</router-link> page to start.
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
  getPatchCompliance,
  type PatchComplianceResponse,
  type ReportFiltersInput,
} from "@/api/reports";
import ReportPageShell from "@/components/reports/ReportPageShell.vue";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards.vue";
import { useReportFilters } from "@/composables/useReportFilters";

const { filters, cache, freshnessLabel } = useReportFilters();
const data = ref<PatchComplianceResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const csvHref = computed(() => csvUrl("patch-compliance", filters.value));

const summaryCards = computed(() => {
  if (!data.value) return [];
  const s = data.value.summary;
  return [
    {
      label: "Fleet compliance",
      value: `${s.fleet_compliance_pct}%`,
      hint: `${s.up_to_date_count} / ${s.total_installs_managed} installs at latest`,
      tone: s.fleet_compliance_pct >= 90 ? "good" :
            s.fleet_compliance_pct >= 60 ? "warn" : "bad",
    },
    { label: "Managed apps", value: s.policy_count, tone: "info" },
    { label: "Outdated installs", value: s.outdated_count,
      tone: s.outdated_count === 0 ? "good" : "warn" },
  ];
});

const cols = [
  { name: "app_name", label: "App", field: "app_name", align: "left" as const, sortable: true },
  { name: "publisher", label: "Publisher", field: "publisher", align: "left" as const, sortable: true },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { name: "package", label: "Package", field: (r: any) => `${r.package_source}:${r.package_id}`,
    align: "left" as const },
  { name: "latest_version_known", label: "Latest", field: "latest_version_known",
    align: "left" as const },
  { name: "installed_count", label: "Installed", field: "installed_count",
    align: "right" as const, sortable: true },
  { name: "up_to_date_count", label: "Up-to-date", field: "up_to_date_count",
    align: "right" as const, sortable: true },
  { name: "outdated_count", label: "Outdated", field: "outdated_count",
    align: "right" as const, sortable: true },
  { name: "compliance_pct", label: "Compliance", field: "compliance_pct",
    align: "right" as const, sortable: true },
];

function pctClass(pct: number) {
  if (pct >= 90) return "report-pct report-pct--good";
  if (pct >= 60) return "report-pct report-pct--warn";
  return "report-pct report-pct--bad";
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getPatchCompliance(filters.value);
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
.report-pct {
  font-weight: var(--intune-font-weight-semibold);
  &--good { color: var(--intune-color-success-600, #107c10); }
  &--warn { color: var(--intune-color-warning-600, #c19c00); }
  &--bad  { color: var(--intune-color-danger-600,  #c50f1f); }
}
</style>
