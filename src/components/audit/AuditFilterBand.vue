<!--
  AuditFilterBand — Phase R. Mirrors Phase I/Q filter-band layout: a row of
  pill-style multi-selects + a saved-views menu on the right.
-->
<template>
  <section class="afb" role="search" aria-label="Audit filters">
    <div class="afb__row">
      <q-select
        v-model="userFilterModel"
        :options="userOptions"
        use-input use-chips multiple new-value-mode="add-unique"
        outlined dense
        input-debounce="0"
        label="User"
        class="afb__select"
        @new-value="(val, done) => { if (val) done(val); }"
      />

      <q-select
        v-model="actionFilterModel"
        :options="actionOptions"
        emit-value map-options multiple
        outlined dense
        label="Action"
        class="afb__select"
      />

      <q-select
        v-model="objectFilterModel"
        :options="objectOptions"
        emit-value map-options multiple
        outlined dense
        label="Object"
        class="afb__select"
      />

      <q-select
        v-model="timeFilterModel"
        :options="timeOptions"
        emit-value map-options
        outlined dense
        label="When"
        class="afb__select"
      />

      <q-btn
        flat dense
        icon="bookmark"
        :label="activeView ? activeView.name : 'Saved views'"
        class="afb__views-btn"
      >
        <q-menu>
          <q-list dense style="min-width: 240px;">
            <q-item-label header>Built-ins &amp; custom</q-item-label>
            <q-item
              v-for="v in savedViews"
              :key="v.id"
              clickable
              :active="v.id === activeViewId"
              @click="$emit('apply-view', v)"
            >
              <q-item-section>{{ v.name }}</q-item-section>
              <q-item-section side v-if="v.id > 0 && v.is_owner">
                <q-btn
                  flat dense round size="sm" icon="delete"
                  @click.stop="$emit('delete-view', v.id)"
                  aria-label="Delete saved view"
                />
              </q-item-section>
            </q-item>
            <q-separator class="q-my-sm" />
            <q-item clickable @click="onSaveDialog">
              <q-item-section avatar>
                <q-icon name="save" size="16px" />
              </q-item-section>
              <q-item-section>Save current filters…</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuasar } from "quasar";

import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/api/audit";
import type { SavedView } from "@/api/savedViews";

const props = defineProps<{
  userFilter: string[];
  actionFilter: string[];
  objectFilter: string[];
  timeFilter: number | null;
  agentSearch: string;
  savedViews: SavedView[];
  activeViewId: number | null;
}>();
const emit = defineEmits<{
  "update:userFilter":   [string[]];
  "update:actionFilter": [string[]];
  "update:objectFilter": [string[]];
  "update:timeFilter":   [number | null];
  "update:agentSearch":  [string];
  "save-view":           [string];
  "apply-view":          [SavedView];
  "delete-view":         [number];
}>();

const $q = useQuasar();

const userFilterModel   = computed({
  get: () => props.userFilter,
  set: v => emit("update:userFilter", v),
});
const actionFilterModel = computed({
  get: () => props.actionFilter,
  set: v => emit("update:actionFilter", v),
});
const objectFilterModel = computed({
  get: () => props.objectFilter,
  set: v => emit("update:objectFilter", v),
});
const timeFilterModel   = computed({
  get: () => props.timeFilter,
  set: v => emit("update:timeFilter", v),
});

const userOptions   = [];   // free-form multi (use-input new-value-mode add-unique)
const actionOptions = AUDIT_ACTIONS.map(a => ({ label: a.label, value: a.value }));
const objectOptions = AUDIT_OBJECTS.map(a => ({ label: a.label, value: a.value }));
const timeOptions   = [
  { label: "Today",       value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "All time",    value: null },
];

const activeView = computed(() =>
  props.savedViews.find(v => v.id === props.activeViewId) ?? null,
);

function onSaveDialog() {
  $q.dialog({
    title: "Save view",
    message: "Name this saved view",
    prompt: { model: "", type: "text", isValid: (v: string) => v.length >= 2 },
    cancel: true,
  }).onOk((name: string) => emit("save-view", name.trim()));
}
</script>

<style lang="scss" scoped>
.afb {
  margin: 12px 0 8px;

  &__row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  &__select {
    min-width: 200px;
    flex: 0 1 auto;
  }
  &__views-btn {
    margin-left: auto;
    text-transform: none;
  }
}
</style>
