<!--
  Phase T2 — URL Actions section.
  Inline q-table + add/edit drawer. Mirror Phase S users/api-keys chrome.
-->
<template>
  <SettingsCard
    title="URL Actions"
    lede="Templated URLs and REST calls invokable from the agent / client / site
          context menu. Drives both 'open in browser' and 'POST to webhook'."
  >
    <div class="ua__bar">
      <q-input
        outlined dense clearable debounce="200"
        :model-value="store.filters.search"
        @update:model-value="(v) => (store.filters.search = String(v ?? ''))"
        placeholder="Search name, description, pattern…"
        class="ua__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-space />
      <q-btn
        flat dense icon="refresh" color="primary"
        :loading="store.loading"
        @click="store.load()"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
      <q-btn
        unelevated color="primary" icon="add" label="Add URL action"
        :disable="!canEdit"
        @click="openAdd"
      />
    </div>

    <q-table
      :rows="store.filteredRows"
      :columns="columns"
      row-key="id"
      flat bordered dense
      :loading="store.loading"
      :rows-per-page-options="[25, 50, 100]"
      no-data-label="No URL actions yet."
    >
      <template #body-cell-action_type="props">
        <q-td :props="props">
          <q-badge
            :color="props.row.action_type === 'rest' ? 'accent' : 'primary'"
            :label="props.row.action_type.toUpperCase()"
          />
        </q-td>
      </template>
      <template #body-cell-pattern="props">
        <q-td :props="props">
          <code class="ua__code">{{ props.row.pattern }}</code>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat dense round icon="edit" :disable="!canEdit" @click="openEdit(props.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat dense round icon="delete" color="negative"
            :disable="!canEdit"
            @click="onDelete(props.row)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <UrlActionFormDrawer
      v-model="formOpen"
      :action="formRow"
      @saved="store.load()"
    />
  </SettingsCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import SettingsCard from "@/components/settings/SettingsCard.vue";
import UrlActionFormDrawer from "@/components/settings/UrlActionFormDrawer.vue";

import { useURLActionsStore } from "@/stores/urlActions";
import { useCurrentUserPermsStore } from "@/stores/permissions";
import { notifySuccess } from "@/utils/notify";
import type { URLAction } from "@/types/core/urlactions";

const store = useURLActionsStore();
const perms = useCurrentUserPermsStore();
const $q = useQuasar();

const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

onMounted(() => store.load());

const formOpen = ref(false);
const formRow = ref<URLAction | null>(null);
function openAdd() { formRow.value = null; formOpen.value = true; }
function openEdit(row: URLAction) { formRow.value = row; formOpen.value = true; }

function onDelete(row: URLAction) {
  $q.dialog({
    title: `Delete URL action "${row.name}"?`,
    message: "Any context menus that reference it will lose the entry.",
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    await store.remove(row.id);
    notifySuccess("URL action deleted");
  });
}

const columns = [
  { name: "name",        label: "Name",        field: "name",        align: "left"  as const, sortable: true },
  { name: "action_type", label: "Type",        field: "action_type", align: "left"  as const, sortable: true },
  { name: "rest_method", label: "Method",      field: "rest_method", align: "left"  as const, sortable: true },
  { name: "pattern",     label: "Pattern",     field: "pattern",     align: "left"  as const },
  { name: "desc",        label: "Description", field: "desc",        align: "left"  as const },
  { name: "actions",     label: "",            field: "id",          align: "right" as const },
];
</script>

<style lang="scss" scoped>
.ua__bar {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
}
.ua__search { min-width: 280px; flex: 0 1 380px; }
.ua__code {
  font-family: var(--intune-font-family-mono, ui-monospace, monospace);
  font-size: var(--intune-font-size-200);
  background: var(--color-bg-surface-2);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
