<!--
  Client Add/Edit drawer.

  Mirrors the legacy ClientsForm dialog (custom fields included) but lives in
  a side drawer to match the Phase I layout. Uses the same /clients/ POST/PUT
  endpoints — no backend changes.
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
    <div class="cfd">
      <header class="cfd__head">
        <h2 class="cfd__title">{{ client ? `Edit ${client.name}` : "Add Client" }}</h2>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <q-form @submit.prevent="submit" class="cfd__form">
        <q-input
          outlined
          dense
          v-model="state.name"
          label="Name"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-input
          v-if="!client"
          outlined
          dense
          v-model="defaultSite.name"
          label="Default first site"
          :rules="[(v) => !!v || 'Required']"
        />

        <div v-if="customFields.length > 0">
          <div class="cfd__section">Custom fields</div>
          <div v-for="field in customFields" :key="field.id" class="cfd__field">
            <CustomField v-model="custom_fields[field.name]" :field="field" />
          </div>
        </div>

        <div class="cfd__actions">
          <q-btn flat label="Cancel" @click="$emit('update:modelValue', false)" />
          <q-btn
            unelevated
            type="submit"
            color="primary"
            label="Save"
            :loading="loading"
          />
        </div>
      </q-form>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useQuasar } from "quasar";

import { saveClient, editClient, fetchClient } from "@/api/clients";
import { fetchCustomFields } from "@/api/core";
import { formatCustomFields } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { useClientsSitesStore } from "@/stores/clientsSites";

import CustomField from "@/components/ui/CustomField.vue";

interface ClientLite { id?: number; name: string }
interface CustomFieldDef {
  id: number;
  name: string;
  type: string;
  hide_in_ui?: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  client?: ClientLite | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const $q = useQuasar();
const store = useClientsSitesStore();

const state = ref<ClientLite>({ name: "" });
const defaultSite = ref({ name: "" });
const customFields = ref<CustomFieldDef[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const custom_fields = ref<Record<string, any>>({});
const loading = ref(false);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    state.value = props.client ? { ...props.client } : { name: "" };
    defaultSite.value = { name: "" };
    custom_fields.value = {};
    try {
      const fields = (await fetchCustomFields({ model: "client" })) as CustomFieldDef[];
      customFields.value = fields.filter((f) => !f.hide_in_ui);
      if (props.client?.id) {
        const data = (await fetchClient(props.client.id)) as { custom_fields?: Array<{ field: number; value: unknown }> };
        for (const field of customFields.value) {
          const v = data.custom_fields?.find((x) => x.field === field.id);
          if (field.type === "multiple") {
            custom_fields.value[field.name] = v ? v.value : [];
          } else if (field.type === "checkbox") {
            custom_fields.value[field.name] = v ? v.value : false;
          } else {
            custom_fields.value[field.name] = v ? v.value : "";
          }
        }
      }
    } catch (e) {
      console.error("Failed to load client custom fields", e);
    }
  },
  { immediate: true },
);

onMounted(() => { /* state initialised by the watcher */ });

async function submit() {
  if (!state.value.name?.trim()) return;
  if (!props.client && !defaultSite.value.name?.trim()) return;
  loading.value = true;
  try {
    const payload = {
      client: state.value,
      site: defaultSite.value,
      custom_fields: formatCustomFields(customFields.value, custom_fields.value),
    };
    const result = props.client?.id
      ? await editClient(props.client.id, payload)
      : await saveClient(payload);
    notifySuccess(result);
    await store.reloadAfterWrite();
    emit("saved");
    emit("update:modelValue", false);
  } catch (e) {
    console.error(e);
    $q.notify({ color: "negative", message: "Save failed", icon: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.cfd {
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
  &__section {
    margin-top: 8px;
    font-size: var(--intune-font-size-100);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--color-fg-tertiary);
  }
  &__field { margin-bottom: 4px; }
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
