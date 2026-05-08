<!--
  CountBar — small inline display of "online / total" with a thin progress bar
  underneath. Used in the workstations + servers columns.
-->
<template>
  <div class="cb" :class="`cb--${tone}`" :title="title">
    <div class="cb__nums">
      <b class="cb__online">{{ online }}</b><span class="cb__sep">/</span><span class="cb__total">{{ total }}</span>
    </div>
    <div class="cb__bar">
      <div class="cb__fill" :style="{ width: pct + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  online: number;
  total: number;
  tone?: "primary" | "brand";
}>();

const pct = computed(() => {
  if (props.total <= 0) return 0;
  return Math.round((props.online / props.total) * 100);
});
const title = computed(() => `${props.online} of ${props.total} online`);
</script>

<style lang="scss" scoped>
.cb {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 56px;

  &__nums {
    font-size: var(--intune-font-size-200);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
  &__online { color: var(--color-fg-primary); }
  &__sep    { color: var(--color-fg-tertiary); margin: 0 2px; }
  &__total  { color: var(--color-fg-secondary); }

  &__bar {
    margin-top: 2px;
    width: 56px;
    height: 4px;
    background: var(--color-bg-elevated, rgba(0,0,0,0.06));
    border-radius: 2px;
    overflow: hidden;
  }
  &__fill {
    height: 100%;
    background: var(--color-brand-rest, #0078d4);
    transition: width 0.2s ease;
  }
  &--brand .cb__fill {
    background: var(--color-status-positive-fg, #107c10);
  }
}
</style>
