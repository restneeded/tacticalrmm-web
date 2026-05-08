<!--
  Phase S — API key add/edit drawer.
  On create: name + bound user + optional expiration; backend generates the
  32-char `key`. After save we surface the new key once (banner inside
  drawer with a copy button); the table also reveals it on demand.
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
    <div class="akd">
      <header class="akd__head">
        <h2 class="akd__title">{{ apiKey ? `Edit ${apiKey.name}` : "Add API key" }}</h2>
        <q-btn flat dense round icon="close" @click="close" />
      </header>

      <q-form @submit.prevent="submit" class="akd__form">
        <q-input
          outlined
          dense
          v-model="state.name"
          label="Name"
          :rules="[(v) => !!v || 'Required', (v) => v.length <= 25 || 'Max 25 chars']"
          maxlength="25"
        />

        <q-select
          outlined
          dense
          map-options
          emit-value
          v-model="state.user"
          :options="userOptions"
          label="Run as user"
          :loading="usersLoading"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-input
          outlined
          dense
          v-model="state.expiration"
          label="Expiration (UTC, blank = never)"
          placeholder="YYYY-MM-DD HH:MM"
          hint="Leave blank for non-expiring key"
        >
          <template #append>
            <q-icon name="schedule" class="cursor-pointer">
              <q-popup-proxy transition-show="scale" transition-hide="scale">
                <q-date v-model="state.expiration" mask="YYYY-MM-DD HH:mm" />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-banner
          v-if="freshKey"
          dense
          rounded
          class="akd__fresh"
        >
          <template #avatar><q-icon name="key" color="positive" /></template>
          New API key — copy it now. The full value is also visible in the
          table by clicking the eye icon.
          <div class="akd__fresh-row">
            <code class="akd__fresh-key">{{ freshKey }}</code>
            <q-btn flat dense icon="content_copy" @click="copyFresh">
              <q-tooltip>Copy</q-tooltip>
            </q-btn>
          </div>
        </q-banner>

        <div class="akd__actions">
          <q-btn flat label="Close" @click="close" />
          <q-btn unelevated type="submit" color="primary" label="Save" :loading="loading" />
        </div>
      </q-form>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuasar, copyToClipboard } from "quasar";

import { useApiKeysStore, type ApiKeyRow } from "@/stores/apiKeys";
import { useUsersStore } from "@/stores/users";
import { notifySuccess } from "@/utils/notify";

const props = defineProps<{
  modelValue: boolean;
  apiKey?: ApiKeyRow | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const $q = useQuasar();
const store = useApiKeysStore();
const userStore = useUsersStore();

interface FormState {
  name: string;
  user: number | null;
  expiration: string;
}

const blank: FormState = { name: "", user: null, expiration: "" };
const state = ref<FormState>({ ...blank });
const loading = ref(false);
const usersLoading = ref(false);
const userOptions = ref<Array<{ label: string; value: number }>>([]);
const freshKey = ref<string | null>(null);

async function ensureUsers() {
  if (userStore.rows.length === 0) {
    usersLoading.value = true;
    try { await userStore.load(); } finally { usersLoading.value = false; }
  }
  userOptions.value = userStore.rows.map((u) => ({
    label: u.username,
    value: u.id,
  }));
}

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  await ensureUsers();
  if (props.apiKey) {
    state.value = {
      name: props.apiKey.name,
      user: props.apiKey.user,
      expiration: props.apiKey.expiration ?? "",
    };
  } else {
    state.value = { ...blank };
  }
  freshKey.value = null;
});

function close() {
  emit("update:modelValue", false);
}

async function copyFresh() {
  if (!freshKey.value) return;
  try {
    await copyToClipboard(freshKey.value);
    $q.notify({ type: "positive", message: "Key copied", timeout: 1500 });
  } catch {
    $q.notify({ type: "negative", message: "Copy failed" });
  }
}

async function submit() {
  if (!state.value.name?.trim() || !state.value.user) return;
  loading.value = true;
  try {
    const payload = {
      name: state.value.name.trim(),
      user: state.value.user,
      expiration: state.value.expiration?.trim() ? state.value.expiration : null,
    };
    if (props.apiKey?.id) {
      await store.update(props.apiKey.id, payload);
      notifySuccess("API key updated");
      emit("saved");
      close();
    } else {
      const created = await store.create(payload);
      // Reveal once: show the key in-drawer (also viewable in table).
      freshKey.value = created?.key ?? null;
      notifySuccess(`API key "${payload.name}" created`);
      emit("saved");
      // do NOT auto-close — let the admin copy the key first.
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[apiKeys] save:", e);
    $q.notify({ type: "negative", message: "Save failed" });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.akd {
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
  &__form { display: flex; flex-direction: column; gap: 14px; flex: 1; }

  &__fresh {
    background: var(--color-bg-surface-2);
    border-left: 3px solid var(--color-positive, #2e7d32);
  }
  &__fresh-row {
    display: flex; align-items: center; gap: 8px; margin-top: 6px;
  }
  &__fresh-key {
    font-family: var(--intune-font-family-mono, ui-monospace, SFMono-Regular, monospace);
    font-size: var(--intune-font-size-200);
    background: var(--color-bg-canvas);
    padding: 4px 8px;
    border-radius: 4px;
    word-break: break-all;
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
