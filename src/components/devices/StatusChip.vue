<!--
  StatusChip — small status indicator. Re-used by Software Inventory in
  Phase D, so the component is generic in `tone` rather than agent-specific.
-->
<template>
  <span class="status-chip" :class="`status-chip--${tone}`" :title="title">
    <span class="status-chip__dot" />
    <span class="status-chip__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  tone: "positive" | "warning" | "negative" | "neutral";
  label: string;
  title?: string;
}>();
</script>

<style lang="scss" scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  font-size: var(--intune-font-size-100);
  font-weight: var(--intune-font-weight-medium);
  line-height: 1;
  border: 1px solid transparent;
  white-space: nowrap;

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &--positive {
    color: var(--color-status-positive-fg, #107c10);
    background: var(--color-status-positive-bg, rgba(16, 124, 16, 0.1));
    border-color: var(--color-status-positive-bg, rgba(16, 124, 16, 0.2));
    .status-chip__dot { background: var(--color-status-positive-fg, #107c10); }
  }
  &--warning {
    color: var(--color-status-warning-fg, #b88217);
    background: var(--color-status-warning-bg, rgba(184, 130, 23, 0.12));
    border-color: var(--color-status-warning-bg, rgba(184, 130, 23, 0.25));
    .status-chip__dot { background: var(--color-status-warning-fg, #b88217); }
  }
  &--negative {
    color: var(--color-status-negative-fg, #c50f1f);
    background: var(--color-status-negative-bg, rgba(197, 15, 31, 0.1));
    border-color: var(--color-status-negative-bg, rgba(197, 15, 31, 0.22));
    .status-chip__dot { background: var(--color-status-negative-fg, #c50f1f); }
  }
  &--neutral {
    color: var(--color-fg-secondary);
    background: var(--color-bg-elevated, rgba(0,0,0,0.04));
    border-color: var(--color-stroke-divider);
    .status-chip__dot { background: var(--color-fg-tertiary); }
  }
}
</style>
