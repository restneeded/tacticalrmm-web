<!--
  Phase S — API keys table.
  Bound user, name, expiration, key (masked w/ reveal toggle).
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
  >
    <template #body-cell-key="props">
      <q-td :props="props">
        <code class="apk-key">{{ revealed.has(props.row.id) ? props.row.key : maskKey(props.row.key) }}</code>
        <q-btn
          flat
          dense
          round
          size="sm"
          :icon="revealed.has(props.row.id) ? 'visibility_off' : 'visibility'"
          @click="toggleReveal(props.row.id)"
        >
          <q-tooltip>{{ revealed.has(props.row.id) ? "Hide" : "Reveal" }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="content_copy"
          @click="copyKey(props.row.key)"
        >
          <q-tooltip>Copy</q-tooltip>
        </q-btn>
      </q-td>
    </template>

    <template #body-cell-expiration="props">
      <q-td :props="props">
        <span v-if="props.row.expiration">{{ props.row.expiration }}</span>
        <span v-else class="apk-never">never</span>
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
import { ref } from "vue";
import { useQuasar, copyToClipboard } from "quasar";

import { useApiKeysStore, type ApiKeyRow } from "@/stores/apiKeys";

defineEmits<{
  (e: "open-edit", row: ApiKeyRow): void;
  (e: "delete", row: ApiKeyRow): void;
}>();

const store = useApiKeysStore();
const $q = useQuasar();
const revealed = ref(new Set<number>());

function toggleReveal(id: number) {
  if (revealed.value.has(id)) revealed.value.delete(id);
  else revealed.value.add(id);
  // trigger reactivity
  revealed.value = new Set(revealed.value);
}

function maskKey(k: string): string {
  if (!k) return "";
  const tail = k.slice(-4);
  return `••••••••••••••••••••••••${tail}`;
}

async function copyKey(k: string) {
  try {
    await copyToClipboard(k);
    $q.notify({ type: "positive", message: "Key copied", timeout: 1500 });
  } catch {
    $q.notify({ type: "negative", message: "Copy failed" });
  }
}

const columns = [
  { name: "name",       label: "Name",       field: "name",       align: "left" as const, sortable: true },
  { name: "username",   label: "User",       field: "username",   align: "left" as const, sortable: true },
  { name: "expiration", label: "Expires",    field: "expiration", align: "left" as const, sortable: true },
  { name: "key",        label: "Key",        field: "key",        align: "left" as const },
  { name: "actions",    label: "",           field: "id",         align: "right" as const },
];
</script>

<style lang="scss" scoped>
.apk-key {
  font-family: var(--intune-font-family-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--intune-font-size-200);
  background: var(--color-bg-surface-2);
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 6px;
}
.apk-never {
  color: var(--color-fg-tertiary);
  font-style: italic;
}
</style>
