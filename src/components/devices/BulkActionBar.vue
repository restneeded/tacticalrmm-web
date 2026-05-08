<!--
  BulkActionBar — sticky bar that shows when ≥1 row is selected.
  Action buttons emit events back to the page; the page owns the actual
  network calls and confirmation dialogs.

  Phase K: extended in-place with the legacy-bulk action set:
    reboot, shutdown, uninstall, recover-services, notify, run-script,
    run-command, scan-patches.

  Phase T3: opt-in `siteScope` prop adds a second action group (Toggle
  Maintenance, Assign Policy, Assign Alert Template, Run URL Action, Run
  Checks) used by ClientsSitesPage when the user has multi-selected site
  rows. The agent-translation actions (run-script etc.) are kept because
  the page can union agents under selected sites.
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
      <q-btn flat dense icon="build_circle" label="Recover services" @click="$emit('recover-services')" />
      <q-btn flat dense icon="campaign"     label="Notify"            @click="$emit('notify')" />

      <template v-if="siteScope">
        <q-separator vertical />
        <q-btn-dropdown flat dense icon="build" label="Maintenance" no-caps>
          <q-list dense>
            <q-item clickable v-close-popup @click="$emit('enable-maintenance')">
              <q-item-section>Enable on all selected</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="$emit('disable-maintenance')">
              <q-item-section>Disable on all selected</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <q-btn flat dense icon="policy"        label="Policy"         @click="$emit('assign-policy')" />
        <q-btn flat dense icon="notifications" label="Alert Template" @click="$emit('assign-alert-template')" />
        <q-btn flat dense icon="open_in_new"   label="URL Action"     @click="$emit('run-url-action')" />
        <q-btn flat dense icon="fact_check"    label="Run Checks"     @click="$emit('run-checks-bulk')" />
      </template>

      <q-separator vertical />
      <q-btn flat dense icon="restart_alt" label="Reboot"   color="negative" @click="$emit('reboot')" />
      <q-btn flat dense icon="power_settings_new" label="Shutdown" color="negative" @click="$emit('shutdown')" />
      <q-btn flat dense icon="delete_forever"     label="Uninstall" color="negative" @click="$emit('uninstall')" />
    </div>

    <q-btn flat dense icon="close" @click="$emit('clear')">
      <q-tooltip>Clear selection</q-tooltip>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import type { AgentRow } from "@/api/devices";
withDefaults(
  defineProps<{ selected: AgentRow[]; siteScope?: boolean }>(),
  { siteScope: false },
);
defineEmits<{
  (e: "run-script"): void;
  (e: "run-command"): void;
  (e: "scan-patches"): void;
  (e: "reboot"): void;
  (e: "shutdown"): void;
  (e: "uninstall"): void;
  (e: "recover-services"): void;
  (e: "notify"): void;
  (e: "clear"): void;
  // Phase T3 — site-scope additions, only emitted when siteScope=true.
  (e: "enable-maintenance"): void;
  (e: "disable-maintenance"): void;
  (e: "assign-policy"): void;
  (e: "assign-alert-template"): void;
  (e: "run-url-action"): void;
  (e: "run-checks-bulk"): void;
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
    flex-wrap: wrap;
    justify-content: center;
    :deep(.q-btn) { color: white; }
    :deep(.q-separator) {
      background: rgba(255,255,255,0.3);
      height: 20px;
      margin: 0 4px;
    }
  }
}
</style>
