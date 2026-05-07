<!--
  CertExpiryCard — days until the TRMM cert expires, surfaced via the
  dashboard.agentcount websocket payload (Phase A's existing store).
-->
<template>
  <DashboardCard
    title="TRMM certificate"
    icon="lock_clock"
    :accent="accent"
    aria-label="TRMM certificate expiry"
  >
    <div class="cert">
      <span class="cert__num">{{ days }}</span>
      <span class="cert__label">days</span>
    </div>
    <p class="cert__caption">
      <template v-if="days >= 30">until the API certificate expires.</template>
      <template v-else-if="days > 0">{{ severityCopy }}</template>
      <template v-else>The TRMM certificate has already expired.</template>
    </p>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { useDashboardStore } from "@/stores/dashboard";

const dash = useDashboardStore();
const days = computed(() => dash.daysUntilCertExpires);

const accent = computed<"ok" | "warn" | "danger">(() => {
  if (days.value <= 7) return "danger";
  if (days.value <= 30) return "warn";
  return "ok";
});

const severityCopy = computed(() => {
  if (days.value <= 7) return "until expiry — renew now.";
  return "until expiry — schedule a renewal.";
});
</script>

<style lang="scss" scoped>
.cert {
  display: flex;
  align-items: baseline;
  gap: 8px;
  &__num {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1;
    color: var(--color-fg-primary);
  }
  &__label {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
  }
  &__caption {
    margin: 8px 0 0 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
}
</style>
