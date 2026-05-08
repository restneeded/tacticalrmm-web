<!-- PendingFilterBand — Phase R. Action / status / search; client-side. -->
<template>
  <section class="pfb" aria-label="Pending filters">
    <q-input
      v-model="searchModel"
      dense outlined
      placeholder="Search agent or action…"
      class="pfb__search"
      clearable
    >
      <template #prepend><q-icon name="search" size="16px" /></template>
    </q-input>

    <q-select
      v-model="actionFilterModel"
      :options="actionOptions"
      emit-value map-options multiple
      outlined dense
      label="Action"
      class="pfb__select"
    />

    <q-select
      v-model="statusFilterModel"
      :options="statusOptions"
      emit-value map-options multiple
      outlined dense
      label="Status"
      class="pfb__select"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { PA_ACTION_LABELS } from "@/api/pending";

const props = defineProps<{
  actionFilter: string[];
  statusFilter: string[];
  search: string;
}>();
const emit = defineEmits<{
  "update:actionFilter": [string[]];
  "update:statusFilter": [string[]];
  "update:search":       [string];
}>();

const actionFilterModel = computed({
  get: () => props.actionFilter,
  set: v => emit("update:actionFilter", v),
});
const statusFilterModel = computed({
  get: () => props.statusFilter,
  set: v => emit("update:statusFilter", v),
});
const searchModel       = computed({
  get: () => props.search,
  set: v => emit("update:search", v ?? ""),
});

const actionOptions = Object.entries(PA_ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const statusOptions = [
  { value: "pending",   label: "Pending" },
  { value: "completed", label: "Completed" },
];
</script>

<style lang="scss" scoped>
.pfb {
  margin: 12px 0 8px;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;

  &__search { min-width: 280px; flex: 0 1 320px; }
  &__select { min-width: 200px; flex: 0 1 240px; }
}
</style>
