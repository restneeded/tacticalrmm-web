<!-- Phase G — small summary-stat card cluster shown above the table on each report. -->
<template>
  <div class="report-summary">
    <div
      v-for="card in cards"
      :key="card.label"
      class="report-summary__card"
      :class="card.tone ? `report-summary__card--${card.tone}` : ''"
    >
      <div class="report-summary__label">{{ card.label }}</div>
      <div class="report-summary__value">{{ card.value }}</div>
      <div v-if="card.hint" class="report-summary__hint">{{ card.hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  cards: Array<{
    label: string;
    value: string | number;
    hint?: string;
    tone?: "good" | "warn" | "bad" | "info";
  }>;
}>();
</script>

<style lang="scss" scoped>
.report-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;

  &__card {
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 14px 16px;
    box-shadow: var(--intune-shadow-1);
    &--good  { border-left: 3px solid var(--intune-color-success-600, #107c10); }
    &--warn  { border-left: 3px solid var(--intune-color-warning-600, #c19c00); }
    &--bad   { border-left: 3px solid var(--intune-color-danger-600,  #c50f1f); }
    &--info  { border-left: 3px solid var(--color-accent-500); }
  }
  &__label {
    font-size: var(--intune-font-size-100);
    color: var(--color-fg-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  &__value {
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-primary);
    line-height: 1.1;
  }
  &__hint {
    margin-top: 4px;
    font-size: var(--intune-font-size-100);
    color: var(--color-fg-secondary);
  }
}
</style>
