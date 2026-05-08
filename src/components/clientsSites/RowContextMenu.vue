<!--
  Phase T3 — RowContextMenu.
  A position-controlled context menu rendered at the page level. The page
  toggles v-model and passes (x, y) from the contextmenu event; we render a
  1×1 anchor div at that fixed point so q-menu can attach to it.

  Op set is the legacy DashboardView tree right-click menu (minus WinGet —
  Phase H ripped — and the EE Reporting submenu, integrations-only).
-->
<template>
  <div
    ref="anchorRef"
    class="rcm-anchor"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
  >
    <q-menu
      :model-value="modelValue"
      @update:model-value="(v) => $emit('update:modelValue', v)"
      no-parent-event
      anchor="top start"
      self="top start"
    >
      <q-list dense style="min-width: 220px">
        <q-item clickable v-close-popup v-ripple @click="$emit('edit')">
          <q-item-section avatar><q-icon name="edit" /></q-item-section>
          <q-item-section>Edit</q-item-section>
        </q-item>
        <q-item clickable v-close-popup v-ripple @click="$emit('delete')">
          <q-item-section avatar><q-icon name="delete" /></q-item-section>
          <q-item-section>Delete</q-item-section>
        </q-item>

        <q-separator />

        <q-item
          v-if="scope === 'client'"
          clickable
          v-close-popup
          v-ripple
          @click="$emit('add-site')"
        >
          <q-item-section avatar><q-icon name="add_business" /></q-item-section>
          <q-item-section>Add Site</q-item-section>
        </q-item>

        <q-item clickable v-close-popup v-ripple @click="$emit('toggle-maintenance')">
          <q-item-section avatar>
            <q-icon :name="maintenanceOn ? 'build_circle' : 'build'" />
          </q-item-section>
          <q-item-section>
            {{ maintenanceOn ? "Disable Maintenance Mode" : "Enable Maintenance Mode" }}
          </q-item-section>
        </q-item>

        <q-item clickable v-close-popup v-ripple @click="$emit('install-agent')">
          <q-item-section avatar><q-icon name="install_desktop" /></q-item-section>
          <q-item-section>Install Agent</q-item-section>
        </q-item>

        <q-separator />

        <q-item clickable v-close-popup v-ripple @click="$emit('assign-policy')">
          <q-item-section avatar><q-icon name="policy" /></q-item-section>
          <q-item-section>Assign Automation Policy</q-item-section>
        </q-item>

        <q-item clickable v-close-popup v-ripple @click="$emit('assign-alert-template')">
          <q-item-section avatar><q-icon name="notifications" /></q-item-section>
          <q-item-section>Assign Alert Template</q-item-section>
        </q-item>

        <q-item clickable @click.stop>
          <q-item-section avatar><q-icon name="open_in_new" /></q-item-section>
          <q-item-section>Run URL Action</q-item-section>
          <q-item-section side><q-icon name="keyboard_arrow_right" /></q-item-section>
          <q-menu auto-close anchor="top end" self="top start">
            <q-list dense>
              <q-item v-if="urlActionsLoading">
                <q-item-section>
                  <q-spinner size="14px" /> Loading…
                </q-item-section>
              </q-item>
              <q-item v-else-if="urlActions.length === 0">
                <q-item-section class="text-grey">
                  No URL Actions configured. Settings &gt; URL Actions.
                </q-item-section>
              </q-item>
              <q-item
                v-for="a in urlActions"
                :key="a.id"
                clickable
                v-ripple
                v-close-popup
                @click="$emit('run-url-action', a.id)"
              >
                <q-item-section>{{ a.name }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-item>

        <q-item clickable v-close-popup v-ripple @click="$emit('run-checks')">
          <q-item-section avatar><q-icon name="fact_check" /></q-item-section>
          <q-item-section>Run Checks</q-item-section>
        </q-item>

        <q-separator />

        <q-item clickable v-close-popup>
          <q-item-section>Close</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { URLAction } from "@/api/clientSiteOps";

defineProps<{
  modelValue: boolean;
  scope: "client" | "site";
  maintenanceOn: boolean;
  urlActions: URLAction[];
  urlActionsLoading: boolean;
  /** Page coordinates (clientX, clientY) from the contextmenu event */
  position: { x: number; y: number };
}>();

defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "edit"): void;
  (e: "delete"): void;
  (e: "add-site"): void;
  (e: "toggle-maintenance"): void;
  (e: "install-agent"): void;
  (e: "assign-policy"): void;
  (e: "assign-alert-template"): void;
  (e: "run-url-action", id: number): void;
  (e: "run-checks"): void;
}>();

const anchorRef = ref<HTMLElement | null>(null);
</script>

<style lang="scss" scoped>
.rcm-anchor {
  position: fixed;
  width: 1px;
  height: 1px;
  pointer-events: none;
  z-index: 9999;
}
</style>
