<!--
  Phase S — /users page.
  Hero header + filter strip + UsersTable + add/edit drawer + detail drawer.
  Reuses Phase I drawer chrome and the fetchUsers/saveUser/editUser/removeUser
  api wrappers in @/api/accounts.
-->
<template>
  <q-page class="users">
    <header class="users__hero">
      <div>
        <h1 class="users__title">Users</h1>
        <p class="users__lede">
          Local TRMM accounts. Click a row to manage sessions, reset MFA,
          reset password, or change role assignment.
        </p>
      </div>
      <div class="users__actions">
        <q-btn unelevated color="primary" icon="person_add" label="Add user" @click="openAdd" />
        <q-btn flat dense icon="refresh" color="primary" :loading="store.loading" @click="store.load()">
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <div class="users__filters">
      <q-input
        outlined
        dense
        clearable
        debounce="200"
        :model-value="store.filters.search"
        @update:model-value="(v) => store.setFilter('search', String(v ?? ''))"
        placeholder="Search username, email, name…"
        class="users__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-toggle
        :model-value="store.filters.activeOnly"
        @update:model-value="(v) => store.setFilter('activeOnly', !!v)"
        label="Active only"
      />
    </div>

    <UsersTable
      @open-detail="openDetail"
      @open-edit="openEdit"
    />

    <UserDetailDrawer
      v-model="detailOpen"
      :user="detailUser"
      @edit="onEditFromDetail"
      @delete="onDeleteFromDetail"
    />
    <UserFormDrawer
      v-model="formOpen"
      :user="formUser"
      @saved="onSaved"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import { useUsersStore, type UserRow } from "@/stores/users";
import { notifySuccess } from "@/utils/notify";

import UsersTable from "@/components/users/UsersTable.vue";
import UserFormDrawer from "@/components/users/UserFormDrawer.vue";
import UserDetailDrawer from "@/components/users/UserDetailDrawer.vue";

const store = useUsersStore();
const $q = useQuasar();

onMounted(() => store.load());

const detailOpen = ref(false);
const detailUser = ref<UserRow | null>(null);
function openDetail(row: UserRow) {
  detailUser.value = row;
  detailOpen.value = true;
}

const formOpen = ref(false);
const formUser = ref<UserRow | null>(null);
function openAdd() {
  formUser.value = null;
  formOpen.value = true;
}
function openEdit(row: UserRow) {
  formUser.value = row;
  formOpen.value = true;
}

function onEditFromDetail() {
  if (!detailUser.value) return;
  formUser.value = detailUser.value;
  detailOpen.value = false;
  formOpen.value = true;
}

function onDeleteFromDetail() {
  const u = detailUser.value;
  if (!u) return;
  $q.dialog({
    title: `Delete ${u.username}?`,
    message: "This permanently removes the account. The TRMM root user cannot be deleted from the UI.",
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    await store.remove(u.id);
    notifySuccess("User deleted");
    detailOpen.value = false;
  });
}

function onSaved() {
  // The drawer already triggered store.load(); just refresh the in-flight
  // detail view so its fields match.
  if (detailUser.value) {
    detailUser.value =
      store.rows.find((r) => r.id === detailUser.value!.id) ?? null;
  }
}
</script>

<style lang="scss" scoped>
.users {
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
  &__filters {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  &__search { min-width: 320px; flex: 0 1 420px; }
}
</style>
