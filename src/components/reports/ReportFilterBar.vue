<!--
  Phase G — shared filter bar for every compliance report.
  Range pills (7/30/90/all) + client/site selects + Export CSV button.
  Emits `update:filters` whenever the user changes anything; the parent
  page is responsible for re-fetching.
-->
<template>
  <div class="report-filters">
    <div class="report-filters__row">
      <div class="report-filters__pills" role="tablist" aria-label="Time range">
        <button
          v-for="opt in RANGE_OPTIONS"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="modelValue.range === opt.value"
          class="report-filters__pill"
          :class="{ 'report-filters__pill--active': modelValue.range === opt.value }"
          @click="setRange(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <q-select
        v-if="clients.length"
        v-model="clientId"
        :options="clientOptions"
        label="Client"
        outlined
        dense
        clearable
        emit-value
        map-options
        class="report-filters__select"
      />

      <q-select
        v-if="sites.length"
        v-model="siteId"
        :options="filteredSiteOptions"
        label="Site"
        outlined
        dense
        clearable
        emit-value
        map-options
        class="report-filters__select"
      />

      <span class="report-filters__spacer" />

      <q-btn
        v-if="csvHref"
        flat
        no-caps
        :href="csvHref"
        icon="download"
        label="Export CSV"
        class="report-filters__csv"
        type="a"
      />
    </div>
    <div v-if="freshness" class="report-filters__fresh">
      {{ freshness }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { ReportFiltersInput, ReportRange } from "@/api/reports";

const props = defineProps<{
  modelValue: ReportFiltersInput;
  clients: Array<{ id: number; name: string }>;
  sites: Array<{ id: number; name: string; client_name?: string; client?: number }>;
  csvHref?: string;
  freshness?: string;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: ReportFiltersInput): void;
}>();

const RANGE_OPTIONS: Array<{ label: string; value: ReportRange }> = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "All time", value: "all" },
];

function setRange(r: ReportRange) {
  emit("update:modelValue", { ...props.modelValue, range: r });
}

const clientId = ref<number | null>(props.modelValue.client_id ?? null);
const siteId = ref<number | null>(props.modelValue.site_id ?? null);

watch(
  () => props.modelValue,
  (v) => {
    clientId.value = v.client_id ?? null;
    siteId.value = v.site_id ?? null;
  },
  { deep: true },
);

watch(clientId, (v) => {
  if (v == null && siteId.value != null) siteId.value = null;
  emit("update:modelValue", {
    ...props.modelValue,
    client_id: v ?? null,
    // Drop site if it no longer belongs to the chosen client.
    site_id: v != null && siteId.value != null
      ? (props.sites.find((s) => s.id === siteId.value)?.client === v ? siteId.value : null)
      : siteId.value,
  });
});
watch(siteId, (v) => {
  emit("update:modelValue", { ...props.modelValue, site_id: v ?? null });
});

const clientOptions = computed(() =>
  props.clients.map((c) => ({ label: c.name, value: c.id })),
);
const filteredSiteOptions = computed(() => {
  const cid = clientId.value;
  const list = cid != null ? props.sites.filter((s) => s.client === cid) : props.sites;
  return list.map((s) => ({
    label: s.client_name ? `${s.client_name} — ${s.name}` : s.name,
    value: s.id,
  }));
});
</script>

<style lang="scss" scoped>
.report-filters {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  padding: 12px 16px;
  margin-bottom: 16px;

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  &__pills {
    display: inline-flex;
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 2px;
    background-color: var(--color-bg-canvas);
  }
  &__pill {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    cursor: pointer;
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-secondary);
    border-radius: calc(var(--intune-radius-medium) - 2px);
    transition: background-color 0.12s ease, color 0.12s ease;
    &:hover { background-color: var(--color-bg-hover); color: var(--color-fg-primary); }
    &:focus-visible { outline: 2px solid var(--color-accent-500); outline-offset: 1px; }
    &--active {
      background-color: var(--color-accent-500);
      color: #fff;
    }
  }
  &__select { min-width: 200px; }
  &__spacer { flex: 1; }
  &__csv {
    text-decoration: none;
  }
  &__fresh {
    margin-top: 6px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
}
</style>
