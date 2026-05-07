<!-- FleetStat — single label + online/total row inside FleetStatusCard. -->
<template>
  <div class="fleet-stat">
    <div class="fleet-stat__label">{{ label }}</div>
    <div class="fleet-stat__value">
      <span class="fleet-stat__online">{{ online }}</span>
      <span class="fleet-stat__total">/ {{ total }}</span>
    </div>
    <div
      class="fleet-stat__sub"
      :data-tone="offline === 0 ? 'ok' : 'bad'"
    >
      {{ offline === 0 ? "All online" : `${offline} offline` }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  online: number;
  total: number;
}>();

const offline = computed(() => Math.max(0, props.total - props.online));
</script>

<style lang="scss" scoped>
.fleet-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  &__label {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  &__value {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.05;
    color: var(--color-fg-primary);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  &__total {
    font-size: var(--intune-font-size-400);
    font-weight: var(--intune-font-weight-regular);
    color: var(--color-fg-tertiary);
  }
  &__sub {
    font-size: var(--intune-font-size-200);
    &[data-tone="ok"]  { color: var(--intune-status-success); }
    &[data-tone="bad"] { color: var(--intune-status-danger); }
  }
}
</style>
