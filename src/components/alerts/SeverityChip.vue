<!--
  SeverityChip — Phase P shared severity pill.
  info=blue, warning=amber, error=red. Reuses tokens from intune-tokens.scss.
-->
<template>
  <span class="sev-chip" :class="`sev-chip--${severity}`">
    <q-icon v-if="icon" :name="icon" size="11px" class="sev-chip__icon" />
    {{ label || severity }}
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  severity: { type: String, required: true }, // "info" | "warning" | "error"
  label: { type: String, default: "" },
});

const icon = computed(() => {
  if (props.severity === "error")   return "error";
  if (props.severity === "warning") return "warning";
  if (props.severity === "info")    return "info";
  return "";
});
</script>

<style lang="scss" scoped>
.sev-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  border: 1px solid transparent;

  &__icon { line-height: 1; }

  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
  }
  &--error {
    background: var(--color-state-negative-bg, #fdeaea);
    color: var(--color-state-negative-fg, #b21f1f);
  }
}
</style>
