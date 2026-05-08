<!--
  Phase S — Users table.
  Flat q-table over the admin user list; row click opens UserDetailDrawer.
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
    v-model:pagination="paginationProxy"
    :sort-by="store.sort.by"
    :descending="store.sort.desc"
    @row-click="(_, row) => $emit('open-detail', row)"
    @update:pagination="onPagination"
  >
    <template #body-cell-mfa="props">
      <q-td :props="props">
        <q-icon
          v-if="props.row.totp_key"
          name="lock"
          color="positive"
          size="18px"
        />
        <q-icon v-else name="lock_open" color="warning" size="18px" />
      </q-td>
    </template>

    <template #body-cell-active="props">
      <q-td :props="props">
        <q-badge
          :color="props.row.is_active ? 'positive' : 'grey'"
          :label="props.row.is_active ? 'Active' : 'Disabled'"
        />
      </q-td>
    </template>

    <template #body-cell-role="props">
      <q-td :props="props">
        {{ roleNameById(props.row.role) || "—" }}
      </q-td>
    </template>

    <template #body-cell-actions="props">
      <q-td :props="props" auto-width>
        <q-btn
          flat
          dense
          round
          icon="edit"
          @click.stop="$emit('open-edit', props.row)"
        >
          <q-tooltip>Edit</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

import { useUsersStore, type UserRow } from "@/stores/users";
import { useRolesStore } from "@/stores/roles";

defineEmits<{
  (e: "open-detail", row: UserRow): void;
  (e: "open-edit", row: UserRow): void;
}>();

const store = useUsersStore();
const roleStore = useRolesStore();

onMounted(() => {
  if (roleStore.rows.length === 0) void roleStore.load();
});

function roleNameById(id: number | null): string {
  if (id == null) return "";
  return (roleStore.rows.find((r) => r.id === id)?.name as string) || "";
}

const columns = [
  { name: "username",   label: "Username",   field: "username",   align: "left" as const, sortable: true },
  { name: "first_name", label: "First name", field: "first_name", align: "left" as const, sortable: true },
  { name: "last_name",  label: "Last name",  field: "last_name",  align: "left" as const, sortable: true },
  { name: "email",      label: "Email",      field: "email",      align: "left" as const, sortable: true },
  { name: "role",       label: "Role",       field: "role",       align: "left" as const },
  { name: "active",     label: "Status",     field: "is_active",  align: "left" as const, sortable: true },
  { name: "mfa",        label: "MFA",        field: "totp_key",   align: "center" as const },
  { name: "last_login", label: "Last login", field: "last_login", align: "left" as const, sortable: true },
  { name: "actions",    label: "",           field: "id",         align: "right" as const },
];

// keep page + rowsPerPage in sync with the store's persisted setting
const paginationProxy = computed({
  get: () => ({
    sortBy: store.sort.by,
    descending: store.sort.desc,
    page: store.page,
    rowsPerPage: store.rowsPerPage,
  }),
  set: () => { /* handled in onPagination */ },
});

function onPagination(p: { sortBy: string; descending: boolean; page: number; rowsPerPage: number }) {
  if (p.sortBy && (p.sortBy !== store.sort.by || p.descending !== store.sort.desc)) {
    store.setSort(p.sortBy, p.descending);
  }
  store.page = p.page;
  if (p.rowsPerPage && p.rowsPerPage !== store.rowsPerPage) {
    store.rowsPerPage = p.rowsPerPage;
  }
}
</script>
