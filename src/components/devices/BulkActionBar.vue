<!--
  BulkActionBar — sticky bar that shows when ≥1 row is selected.
  Action buttons emit events back to the page; the page owns the actual
  network calls and confirmation dialogs.
-->
<template>
  <div class="bab">
    <div class="bab__count">
      <q-icon name="check_circle" size="18px" />
      <span><b>{{ selected.length }}</b> selected</span>
    </div>

    <div class="bab__actions">
      <q-btn flat dense icon="play_arrow" label="Run script" @click="$emit('run-script')" />
      <q-btn flat dense icon="terminal"   label="Run command" @click="$emit('run-command')" />
      <q-btn flat dense icon="search"     label="Scan patches" @click="$emit('scan-patches')" />
      <q-separator vertical />
      <q-btn flat dense icon="restart_alt" label="Reboot" color="negative" @click="$emit('reboot')" />
    </div>

    <q-btn flat dense icon="close" @click="$emit('clear')">
      <q-tooltip>Clear selection</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import type { AgentRow } from "@/api/devices";
defineProps<{ selected: AgentRow[] }>();
defineEmits<{
  (e: "run-script"): void;
  (e: "run-command"): void;
  (e: "scan-patches"): void;
  (e: "reboot"): void;
  (e: "clear"): void;
}>();
</script>

<style lang="scss" scoped>
.bab {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--color-brand-rest, #0078d4);
  color: white;
  border-radius: var(--intune-radius-medium);
  box-shadow: var(--intune-shadow-2);

  &__count {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: var(--intune-font-weight-medium);
    white-space: nowrap;
  }
  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    margin-right: auto;
    :deep(.q-btn) { color: white; }
    :deep(.q-separator) {
      background: rgba(255,255,255,0.3);
      height: 20px;
      margin: 0 4px;
    }
  }
}
</style>
