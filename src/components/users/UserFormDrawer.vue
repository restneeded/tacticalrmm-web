<!--
  Phase S — User add/edit drawer.
  Mirrors Phase I drawer chrome (q-drawer side="right", 480px, overlay).
  On create: requires username, password, email; role optional.
  On edit:   PATCH-style PUT; password isn't shown (admins use the
             "Reset password" button on the detail drawer instead).
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right"
    overlay
    bordered
    :width="480"
    :breakpoint="0"
  >
    <div class="ufd">
      <header class="ufd__head">
        <h2 class="ufd__title">{{ user ? `Edit ${user.username}` : "Add user" }}</h2>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <q-form @submit.prevent="submit" class="ufd__form">
        <q-input
          outlined
          dense
          v-model="state.username"
          label="Username"
          :disable="!!user"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-input
          v-if="!user"
          outlined
          dense
          v-model="state.password"
          label="Password"
          :type="showPwd ? 'text' : 'password'"
          :rules="[(v) => !!v || 'Required']"
        >
          <template #append>
            <q-icon
              :name="showPwd ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showPwd = !showPwd"
            />
          </template>
        </q-input>

        <q-input
          outlined
          dense
          v-model="state.email"
          label="Email"
          type="email"
          :rules="[(v) => !v || /.+@.+\..+/.test(v) || 'Invalid email']"
        />

        <q-input outlined dense v-model="state.first_name" label="First name" />
        <q-input outlined dense v-model="state.last_name"  label="Last name" />

        <q-select
          outlined
          dense
          map-options
          emit-value
          clearable
          v-model="state.role"
          :options="roleOptions"
          label="Role"
        />

        <q-toggle
          v-model="state.is_active"
          label="Active"
          :disable="user?.username === auth.username"
        />
        <q-toggle
          v-model="state.block_dashboard_login"
          label="Deny dashboard login"
          :disable="user?.username === auth.username"
        />

        <div class="ufd__actions">
          <q-btn flat label="Cancel" @click="$emit('update:modelValue', false)" />
          <q-btn unelevated type="submit" color="primary" label="Save" :loading="loading" />
        </div>
      </q-form>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useQuasar } from "quasar";

import { useAuthStore } from "@/stores/auth";
import { useRolesStore } from "@/stores/roles";
import { useUsersStore, type UserRow } from "@/stores/users";
import { notifySuccess } from "@/utils/notify";

const props = defineProps<{
  modelValue: boolean;
  user?: UserRow | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const $q = useQuasar();
const auth = useAuthStore();
const roleStore = useRolesStore();
const userStore = useUsersStore();

interface FormState {
  id?: number;
  username: string;
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number | null;
  is_active: boolean;
  block_dashboard_login: boolean;
}

const blank: FormState = {
  username: "",
  password: "",
  email: "",
  first_name: "",
  last_name: "",
  role: null,
  is_active: true,
  block_dashboard_login: false,
};

const state = ref<FormState>({ ...blank });
const showPwd = ref(false);
const loading = ref(false);

const roleOptions = ref<Array<{ label: string; value: number }>>([]);

function reseed() {
  if (props.user) {
    state.value = {
      id: props.user.id,
      username: props.user.username,
      password: "",
      email: props.user.email ?? "",
      first_name: props.user.first_name ?? "",
      last_name: props.user.last_name ?? "",
      role: props.user.role ?? null,
      is_active: props.user.is_active,
      block_dashboard_login: props.user.block_dashboard_login,
    };
  } else {
    state.value = { ...blank };
  }
  showPwd.value = false;
}

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  if (roleStore.rows.length === 0) await roleStore.load();
  roleOptions.value = roleStore.rows.map((r) => ({ label: r.name as string, value: r.id }));
  reseed();
});

onMounted(() => { /* state seeded by watcher */ });

async function submit() {
  if (!state.value.username?.trim()) return;
  if (!props.user && !state.value.password) return;
  loading.value = true;
  try {
    if (props.user?.id) {
      const payload: Record<string, unknown> = { ...state.value };
      delete payload.password;
      // never PUT username (backend ignores changes anyway, but be explicit)
      delete payload.username;
      // self-edit: don't change own active / block flags
      if (props.user.username === auth.username) {
        delete payload.is_active;
        delete payload.block_dashboard_login;
      }
      await userStore.update(props.user.id, payload);
      notifySuccess("User updated");
    } else {
      await userStore.create(state.value);
      notifySuccess(`User ${state.value.username} created`);
    }
    emit("saved");
    emit("update:modelValue", false);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[users] save:", e);
    $q.notify({ type: "negative", message: "Save failed" });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.ufd {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  &__title {
    margin: 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: -0.2px;
  }
  &__form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }
  &__actions {
    margin-top: auto;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--color-stroke-divider);
  }
}
</style>
