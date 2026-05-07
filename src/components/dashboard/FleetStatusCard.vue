<!--
  FleetStatusCard — server + workstation counts (online/offline).
  Data source: existing Pinia store useDashboardStore which is
  driven by the dashboard.agentcount websocket event (Phase A).
-->
<template>
  <DashboardCard
    title="Fleet status"
    icon="dns"
    :to="{ name: 'Devices' }"
    :accent="accent"
    aria-label="Fleet status"
  >
    <div class="fleet">
      <div class="fleet__row">
        <FleetStat
          label="Servers"
          :online="serversOnline"
          :total="dash.serverCount"
        />
        <FleetStat
          label="Workstations"
          :online="workstationsOnline"
          :total="dash.workstationCount"
        />
      </div>

      <div class="fleet__bar" role="img" :aria-label="barAriaLabel">
        <span
          class="fleet__bar-seg fleet__bar-seg--online"
          :style="{ flexGrow: onlinePct }"
        />
        <span
          class="fleet__bar-seg fleet__bar-seg--offline"
          :style="{ flexGrow: 100 - onlinePct }"
        />
      </div>
      <p class="fleet__caption">
        {{ totalOnline }} of {{ totalAgents }} agents online
        <span v-if="totalAgents === 0" class="fleet__empty">— no agents enrolled yet</span>
      </p>
    </div>

    <template #footer>
      Updated live via websocket
    </template>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import DashboardCard from "./DashboardCard.vue";
import FleetStat from "./FleetStat.vue";
import { useDashboardStore } from "@/stores/dashboard";

const dash = useDashboardStore();

const serversOnline = computed(() => dash.serverCount - dash.serverOfflineCount);
const workstationsOnline = computed(
  () => dash.workstationCount - dash.workstationOfflineCount,
);
const totalAgents = computed(() => dash.serverCount + dash.workstationCount);
const totalOnline = computed(() => serversOnline.value + workstationsOnline.value);
const totalOffline = computed(
  () => dash.serverOfflineCount + dash.workstationOfflineCount,
);

const onlinePct = computed(() =>
  totalAgents.value === 0
    ? 100
    : Math.round((totalOnline.value / totalAgents.value) * 100),
);

const accent = computed<"ok" | "warn" | "danger" | undefined>(() => {
  if (totalAgents.value === 0) return undefined;
  if (totalOffline.value === 0) return "ok";
  // >=20% offline is bad
  return totalOffline.value / totalAgents.value >= 0.2 ? "danger" : "warn";
});

const barAriaLabel = computed(() =>
  totalAgents.value === 0
    ? "No agents enrolled"
    : `${onlinePct.value} percent of agents online`,
);
</script>

<style lang="scss" scoped>
.fleet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  &__bar {
    display: flex;
    height: 6px;
    border-radius: var(--intune-radius-circular);
    overflow: hidden;
    background-color: var(--color-bg-surface-2);
  }
  &__bar-seg {
    display: block;
    transition: flex-grow var(--intune-duration-gentle) var(--intune-curve-easy-ease);
    &--online  { background-color: var(--intune-status-success); }
    &--offline { background-color: var(--intune-status-danger); }
  }
  &__caption {
    margin: 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-secondary);
  }
  &__empty {
    color: var(--color-fg-tertiary);
  }
}
</style>
