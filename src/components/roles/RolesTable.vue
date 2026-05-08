<!--
  Phase S — Roles table.
  Flat list of all roles with user_count + superuser badge.
  Row click → open RoleFormDrawer in edit mode.
-->
<template>
  <q-table
    :rows="store.filteredRows"
    :columns="columns"
    row-key="id"
    flat
    bordered
    dense
    :loading="store.loading"
    :rows-per-page-options="[25, 50, 100]"
    @row-click="(_, row) => $emit('open-edit', row)"
  >
    <template #body-cell-superuser="props">
      <q-td :props="props">
        <q-badge v-if="props.row.is_superuser" color="warning" label="Superuser" />
        <span v-else>—</span>
      </q-td>
    </template>

    <template #body-cell-actions="props">
      <q-td :props="props" auto-width>
        <q-btn flat dense round icon="edit" @click.stop="$emit('open-edit', props.row)">
          <q-tooltip>Edit</q-tooltip>
        </q-btn>
        <q-btn flat dense round icon="delete" color="negative" @click.stop="$emit('delete', props.row)">
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { useRolesStore, type RoleRow } from "@/stores/roles";

defineEmits<{
  (e: "open-edit", row: RoleRow): void;
  (e: "delete", row: RoleRow): void;
}>();

const store = useRolesStore();

const columns = [
  { name: "name",       label: "Name",       field: "name",       align: "left" as const, sortable: true },
  { name: "user_count", label: "Users",      field: "user_count", align: "right" as const, sortable: true },
  { name: "superuser",  label: "",           field: "is_superuser", align: "left" as const },
  { name: "actions",    label: "",           field: "id",         align: "right" as const },
];
</script>
