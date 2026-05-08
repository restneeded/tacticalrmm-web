<!--
  Phase S — /api-keys page.
  Hero + search + ApiKeysTable + add/edit drawer.
-->
<template>
  <q-page class="apk">
    <header class="apk__hero">
      <div>
        <h1 class="apk__title">API keys</h1>
        <p class="apk__lede">
          Long-lived bearer keys for scripted integrations. Each key inherits
          the permissions of its bound TRMM user.
        </p>
      </div>
      <div class="apk__actions">
        <q-btn unelevated color="primary" icon="vpn_key" label="Add API key" @click="openAdd" />
        <q-btn flat dense icon="refresh" color="primary" :loading="store.loading" @click="store.load()">
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <div class="apk__filters">
      <q-input
        outlined
        dense
        clearable
        debounce="200"
        :model-value="store.filters.search"
        @update:model-value="(v) => (store.filters.search = String(v ?? ''))"
        placeholder="Search key name or user…"
        class="apk__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </div>

    <ApiKeysTable
      @open-edit="openEdit"
      @delete="onDelete"
    />

    <ApiKeyFormDrawer
      v-model="formOpen"
      :api-key="formKey"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import { useApiKeysStore, type ApiKeyRow } from "@/stores/apiKeys";
import { notifySuccess } from "@/utils/notify";

import ApiKeysTable from "@/components/apiKeys/ApiKeysTable.vue";
import ApiKeyFormDrawer from "@/components/apiKeys/ApiKeyFormDrawer.vue";

const store = useApiKeysStore();
const $q = useQuasar();

onMounted(() => store.load());

const formOpen = ref(false);
const formKey = ref<ApiKeyRow | null>(null);
function openAdd() { formKey.value = null; formOpen.value = true; }
function openEdit(row: ApiKeyRow) { formKey.value = row; formOpen.value = true; }

function onDelete(row: ApiKeyRow) {
  $q.dialog({
    title: `Delete API key "${row.name}"?`,
    message: "Any scripts using this key will start failing immediately.",
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    await store.remove(row.id);
    notifySuccess("API key deleted");
  });
}
</script>

<style lang="scss" scoped>
.apk {
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
