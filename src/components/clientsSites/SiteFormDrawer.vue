<!--
  Site Add/Edit drawer. Mirrors legacy SitesForm with the same custom fields
  + client dropdown. Uses /clients/sites/ POST/PUT.
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
    <div class="sfd">
      <header class="sfd__head">
        <h2 class="sfd__title">{{ site?.id ? `Edit site` : "Add Site" }}</h2>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <q-form @submit.prevent="submit" class="sfd__form">
        <TacticalDropdown
          v-model="state.client"
          label="Client"
          :options="clientOptions"
          outlined
          mapOptions
          :rules="[(v) => !!v || 'Client is required']"
          filterable
        />
        <q-input
          outlined
          dense
          v-model="state.name"
          label="Name"
          :rules="[(v) => !!v || 'Name is required']"
        />

        <div v-if="customFields.length > 0">
          <div class="sfd__section">Custom fields</div>
          <div v-for="field in customFields" :key="field.id" class="sfd__field">
            <CustomField v-model="custom_fields[field.name]" :field="field" />
          </div>
        </div>

        <div class="sfd__actions">
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
import { ref, watch } from "vue";
import { useQuasar } from "quasar";

import { saveSite, editSite, fetchSite } from "@/api/clients";
import { fetchCustomFields } from "@/api/core";
import { formatCustomFields } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import { useClientDropdown } from "@/composables/clients";
import { useClientsSitesStore } from "@/stores/clientsSites";

import CustomField from "@/components/ui/CustomField.vue";
import TacticalDropdown from "@/components/ui/TacticalDropdown.vue";

interface SiteLite { id?: number; client?: number; name: string }
interface CustomFieldDef {
  id: number;
  name: string;
  type: string;
  hide_in_ui?: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  site?: SiteLite | null;
  defaultClientId?: number | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const $q = useQuasar();
const store = useClientsSitesStore();
const { clientOptions } = useClientDropdown(true);

const state = ref<SiteLite>({ name: "", client: undefined });
const customFields = ref<CustomFieldDef[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const custom_fields = ref<Record<string, any>>({});
const loading = ref(false);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    state.value = props.site
      ? { ...props.site }
      : { name: "", client: props.defaultClientId ?? undefined };
    custom_fields.value = {};
    try {
      const fields = (await fetchCustomFields({ model: "site" })) as CustomFieldDef[];
      customFields.value = fields.filter((f) => !f.hide_in_ui);
      if (props.site?.id) {
        const data = (await fetchSite(props.site.id)) as { custom_fields?: Array<{ field: number; value: unknown }> };
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
      console.error("Failed to load site custom fields", e);
    }
  },
  { immediate: true },
);

async function submit() {
  if (!state.value.name?.trim() || !state.value.client) return;
  loading.value = true;
  try {
    const payload = {
      site: state.value,
      custom_fields: formatCustomFields(customFields.value, custom_fields.value),
    };
    const result = props.site?.id
      ? await editSite(props.site.id, payload)
      : await saveSite(payload);
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
.sfd {
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
