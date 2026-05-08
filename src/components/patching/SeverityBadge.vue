<!--
  SeverityBadge — small chip used across the Patching surface.
  Critical = red, Important = amber, Moderate = blue, Low = gray, Optional = neutral.
-->
<template>
  <span class="sev" :class="`sev--${tone}`">{{ severity || "Optional" }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ severity?: string | null }>();

const tone = computed(() => {
  const s = (props.severity || "").toLowerCase();
  if (s === "critical") return "crit";
  if (s === "important") return "warn";
  if (s === "moderate") return "info";
  if (s === "low") return "low";
  return "neutral";
});
</script>

<style lang="scss" scoped>
.sev {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 8px;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  &--crit {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
  }
  &--warn {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
  }
  &--info {
    background: var(--color-state-info-bg, #e3f2fd);
    color: var(--color-state-info-fg, #054a91);
  }
  &--low {
    background: var(--color-bg-page);
    color: var(--color-fg-secondary);
    border: 1px solid var(--color-border-subtle);
  }
  &--neutral {
    background: var(--color-bg-page);
    color: var(--color-fg-secondary);
  }
}
</style>
