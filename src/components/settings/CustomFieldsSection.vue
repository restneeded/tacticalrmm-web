<!--
  Phase T2 — Custom Fields section.
  Inline q-table + add/edit drawer over /core/customfields/.
-->
<template>
  <SettingsCard
    title="Custom Fields"
    lede="Tenant-defined per-Agent / per-Client / per-Site fields. Values are
          stored against the target instance and surface in detail pages."
  >
    <div class="cf__bar">
      <q-input
        outlined dense clearable debounce="200"
        :model-value="store.filters.search"
        @update:model-value="(v) => (store.filters.search = String(v ?? ''))"
        placeholder="Search field name…"
        class="cf__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-btn-toggle
        :model-value="store.filters.model"
        @update:model-value="(v) => (store.filters.model = v)"
        :options="[
          { value: 'all',    label: 'All' },
          { value: 'agent',  label: 'Agents' },
          { value: 'client', label: 'Clients' },
          { value: 'site',   label: 'Sites' },
        ]"
        no-caps dense outline
      />
      <q-space />
      <q-btn
        flat dense icon="refresh" color="primary"
        :loading="store.loading"
        @click="store.load()"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
      <q-btn
        unelevated color="primary" icon="add" label="Add field"
        :disable="!canManage"
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
      no-data-label="No custom fields yet."
    >
      <template #body-cell-model="props">
        <q-td :props="props">
          <q-badge :label="props.row.model.toUpperCase()" />
        </q-td>
      </template>
      <template #body-cell-required="props">
        <q-td :props="props">
          <q-icon
            :name="props.row.required ? 'check_circle' : 'remove'"
            :color="props.row.required ? 'positive' : 'grey-5'"
          />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat dense round icon="edit" :disable="!canManage" @click="openEdit(props.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat dense round icon="delete" color="negative"
            :disable="!canManage"
            @click="onDelete(props.row)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <CustomFieldFormDrawer
      v-model="formOpen"
      :field="formRow"
      @saved="store.load()"
    />
  </SettingsCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import SettingsCard from "@/components/settings/SettingsCard.vue";
import CustomFieldFormDrawer from "@/components/settings/CustomFieldFormDrawer.vue";

import { useCustomFieldsStore } from "@/stores/customFields";
import { useCurrentUserPermsStore } from "@/stores/permissions";
import { notifySuccess } from "@/utils/notify";
import type { CustomField } from "@/types/core/customfields";

const store = useCustomFieldsStore();
const perms = useCurrentUserPermsStore();
const $q = useQuasar();

const canManage = computed(
  () => perms.perms.is_superuser || perms.perms.can_manage_customfields,
);

onMounted(() => store.load());

const formOpen = ref(false);
const formRow = ref<CustomField | null>(null);
function openAdd() { formRow.value = null; formOpen.value = true; }
function openEdit(row: CustomField) { formRow.value = row; formOpen.value = true; }

function onDelete(row: CustomField) {
  $q.dialog({
    title: `Delete custom field "${row.name}"?`,
    message: "This removes the definition. Any stored values on existing rows are dropped.",
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    await store.remove(row.id);
    notifySuccess("Custom field deleted");
  });
}

const columns = [
  { name: "name",     label: "Name",     field: "name",     align: "left"  as const, sortable: true },
  { name: "model",    label: "Scope",    field: "model",    align: "left"  as const, sortable: true },
  { name: "type",     label: "Type",     field: "type",     align: "left"  as const, sortable: true },
  { name: "required", label: "Required", field: "required", align: "center" as const },
  { name: "actions",  label: "",         field: "id",       align: "right" as const },
];
</script>

<style lang="scss" scoped>
.cf__bar {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  flex-wrap: wrap;
}
.cf__search { min-width: 220px; flex: 0 1 320px; }
</style>
