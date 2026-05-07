<template>
  <ReportPageShell
    title="Software Inventory"
    icon="inventory_2"
    lede="Fleet rollup of installed apps, top publishers, and inventory coverage."
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

      <div class="inv-grid">
        <section class="inv-block">
          <h2 class="inv-block__title">Top apps by prevalence</h2>
          <q-table
            :rows="data.top_apps"
            :columns="topAppCols"
            row-key="app_id"
            flat bordered dense hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          />
        </section>
        <section class="inv-block">
          <h2 class="inv-block__title">Top publishers</h2>
          <q-table
            :rows="data.top_publishers"
            :columns="topPubCols"
            row-key="publisher"
            flat bordered dense hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          />
        </section>
        <section class="inv-block">
          <h2 class="inv-block__title">Agents with most software</h2>
          <q-table
            :rows="data.top_agents"
            :columns="topAgentCols"
            row-key="agent_id"
            flat bordered dense hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          />
        </section>
        <section class="inv-block">
          <h2 class="inv-block__title">
            Agents missing inventory ({{ data.agents_no_inventory.length }})
          </h2>
          <q-table
            :rows="data.agents_no_inventory"
            :columns="missingCols"
            row-key="agent_id"
            flat bordered dense
            :rows-per-page-options="[10, 25]"
          />
        </section>
      </div>
    </template>
    <q-inner-loading :showing="loading" />
  </ReportPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { errMsg } from "@/utils/errMsg";

import {
  csvUrl,
  getSoftwareInventory,
  type ReportFiltersInput,
  type SoftwareInventoryResponse,
} from "@/api/reports";
import ReportPageShell from "@/components/reports/ReportPageShell.vue";
import ReportSummaryCards from "@/components/reports/ReportSummaryCards.vue";
import { useReportFilters } from "@/composables/useReportFilters";

const { filters, cache, freshnessLabel } = useReportFilters();
const data = ref<SoftwareInventoryResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const csvHref = computed(() => csvUrl("software-inventory", filters.value));

const summaryCards = computed(() => {
  if (!data.value) return [];
  const s = data.value.summary;
  return [
    { label: "Distinct apps", value: s.total_distinct_apps, tone: "info" as const },
    { label: "Managed", value: s.managed_count, tone: "good" as const },
    { label: "Unmanaged", value: s.unmanaged_count,
      tone: s.unmanaged_count > 0 ? "warn" as const : undefined },
    { label: "Agents w/ inventory", value: s.agents_with_inventory, tone: "info" as const,
      hint: `${s.agents_without_inventory} missing data` },
  ];
});

const topAppCols = [
  { name: "name", label: "App", field: "name", align: "left" as const },
  { name: "publisher", label: "Publisher", field: "publisher", align: "left" as const },
  { name: "agent_count", label: "Agents", field: "agent_count", align: "right" as const },
];
const topPubCols = [
  { name: "publisher", label: "Publisher", field: "publisher", align: "left" as const },
  { name: "install_count", label: "Installs", field: "install_count", align: "right" as const },
];
const topAgentCols = [
  { name: "hostname", label: "Hostname", field: "hostname", align: "left" as const },
  { name: "install_count", label: "# Apps", field: "install_count", align: "right" as const },
];
const missingCols = [
  { name: "hostname", label: "Hostname", field: "hostname", align: "left" as const },
];

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getSoftwareInventory(filters.value);
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
.inv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}
.inv-block {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  padding: 16px;
  &__title {
    font-size: var(--intune-font-size-300);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 12px 0;
    color: var(--color-fg-primary);
  }
}
</style>
