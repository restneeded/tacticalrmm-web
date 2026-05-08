<!--
  Phase S — /roles page.
  Hero + search + RolesTable + add/edit drawer.
-->
<template>
  <q-page class="roles">
    <header class="roles__hero">
      <div>
        <h1 class="roles__title">Roles</h1>
        <p class="roles__lede">
          Permission bundles for TRMM users. Each user is assigned at most
          one role; superuser roles bypass every permission check.
        </p>
      </div>
      <div class="roles__actions">
        <q-btn unelevated color="primary" icon="add_moderator" label="Add role" @click="openAdd" />
        <q-btn flat dense icon="refresh" color="primary" :loading="store.loading" @click="store.load()">
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <div class="roles__filters">
      <q-input
        outlined
        dense
        clearable
        debounce="200"
        :model-value="store.filters.search"
        @update:model-value="(v) => (store.filters.search = String(v ?? ''))"
        placeholder="Search role name…"
        class="roles__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </div>

    <RolesTable
      @open-edit="openEdit"
      @delete="onDelete"
    />

    <RoleFormDrawer
      v-model="formOpen"
      :role="formRole"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import { useRolesStore, type RoleRow } from "@/stores/roles";
import { notifySuccess } from "@/utils/notify";

import RolesTable from "@/components/roles/RolesTable.vue";
import RoleFormDrawer from "@/components/roles/RoleFormDrawer.vue";

const store = useRolesStore();
const $q = useQuasar();

onMounted(() => store.load());

const formOpen = ref(false);
const formRole = ref<RoleRow | null>(null);
function openAdd() {
  formRole.value = null;
  formOpen.value = true;
}
function openEdit(row: RoleRow) {
  formRole.value = row;
  formOpen.value = true;
}

function onDelete(row: RoleRow) {
  $q.dialog({
    title: `Delete role "${row.name}"?`,
    message: row.user_count > 0
      ? `${row.user_count} user(s) currently have this role. They will become role-less.`
      : "Permanently remove this role.",
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    await store.remove(row.id);
    notifySuccess("Role deleted");
  });
}
</script>

<style lang="scss" scoped>
.roles {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 16px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.1;
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0;
    max-width: 720px;
  }
  &__actions { display: flex; gap: 8px; align-items: center; }
  &__filters { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  &__search { min-width: 320px; flex: 0 1 420px; }
}
</style>
