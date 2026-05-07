<template>
  <div class="compliance">
    <q-circular-progress
      :value="percentLatest"
      size="36px"
      :thickness="0.22"
      :color="bandColor"
      track-color="grey-3"
      class="compliance__ring"
    >
      <span class="compliance__pct">{{ Math.round(percentLatest) }}%</span>
    </q-circular-progress>
    <div class="compliance__text">
      <div class="compliance__head">
        <span :class="`compliance__head--${band}`">
          {{ row.installation_count }}/{{ row.installation_count }} on {{ row.latest_seen_version || "—" }}
        </span>
      </div>
      <div v-if="row.version_count_distinct > 1" class="compliance__sub">
        {{ row.version_count_distinct - 1 }} older version{{ row.version_count_distinct - 1 === 1 ? "" : "s" }} in fleet
      </div>
      <div v-else class="compliance__sub compliance__sub--ok">
        Fleet-wide on latest seen
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { InstalledAppListRow } from "@/api/softwareInventory";

const props = defineProps<{
  row: InstalledAppListRow;
  totalAgents: number;
}>();

// Phase E doesn't yet ship "agents on each version" telemetry inline on
// the list serializer — only oldest/latest version + count. So compliance
// here is a coarse proxy: 100% if every install is on the latest seen
// version (single-version fleet), otherwise we estimate from version
// drift. Phase G will replace this with a real compliance computation
// that reads version_distribution per agent.
const percentLatest = computed(() => {
  if (props.row.version_count_distinct <= 1) return 100;
  // Best-effort heuristic until the per-version count lands inline.
  // 2 versions in fleet → assume ~70% on latest, scale down with drift.
  const drift = props.row.version_count_distinct;
  return Math.max(20, 100 - (drift - 1) * 18);
});

const band = computed<"good" | "warn" | "bad">(() => {
  if (percentLatest.value >= 95) return "good";
  if (percentLatest.value >= 60) return "warn";
  return "bad";
});

const bandColor = computed(() => {
  if (band.value === "good") return "positive";
  if (band.value === "warn") return "warning";
  return "negative";
});
</script>

<style lang="scss" scoped>
.compliance {
  display: flex;
  align-items: center;
  gap: var(--intune-space-m);

  &__ring { flex-shrink: 0; }
  &__pct {
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-secondary);
  }
  &__text { display: flex; flex-direction: column; }
  &__head {
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-primary);

    &--good { color: var(--intune-status-success); }
    &--warn { color: var(--intune-status-warning); }
    &--bad  { color: var(--intune-status-danger); }
  }
  &__sub {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    margin-top: 2px;

    &--ok { color: var(--intune-status-success); }
  }
}
</style>
