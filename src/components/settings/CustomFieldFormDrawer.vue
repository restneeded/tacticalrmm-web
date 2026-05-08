<!--
  Phase T2 — Custom Field add/edit drawer.
  Mirrors the Phase S form drawer chrome.
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right" overlay bordered :width="540" :breakpoint="0"
  >
    <div class="cfd">
      <header class="cfd__head">
        <h2 class="cfd__title">{{ field ? `Edit ${field.name}` : "Add custom field" }}</h2>
        <q-btn flat dense round icon="close" @click="close" />
      </header>

      <q-form @submit.prevent="submit" class="cfd__form">
        <q-input
          outlined dense
          v-model="state.name"
          label="Field name"
          :rules="[(v) => !!v || 'Required', (v) => v.length <= 100 || 'Max 100 chars']"
          maxlength="100"
        />

        <q-select
          outlined dense map-options emit-value
          v-model="state.model"
          :options="modelOptions"
          label="Scope"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-select
          outlined dense map-options emit-value
          v-model="state.type"
          :options="typeOptions"
          label="Field type"
          :rules="[(v) => !!v || 'Required']"
        />

        <template v-if="state.type === 'single' || state.type === 'multiple'">
          <RecipientsEditor
            v-model="state.options"
            placeholder="add option + Enter"
          />
        </template>

        <q-toggle v-model="state.required" label="Required" />
        <q-toggle v-model="state.hide_in_ui" label="Hide in UI" />
        <q-toggle v-model="state.hide_in_summary" label="Hide in summary" />

        <q-input
          v-if="state.type === 'text' || state.type === 'number' || state.type === 'datetime' || state.type === 'single'"
          outlined dense
          v-model="state.default_value_string"
          label="Default value"
          :type="state.type === 'number' ? 'number' : 'text'"
        />
        <q-toggle
          v-if="state.type === 'checkbox'"
          v-model="state.default_value_bool"
          label="Default value (checked)"
        />
        <RecipientsEditor
          v-if="state.type === 'multiple'"
          v-model="state.default_values_multiple"
          placeholder="add default value + Enter"
        />

        <div class="cfd__foot">
          <q-btn flat no-caps label="Cancel" @click="close" />
          <q-btn
            unelevated color="primary" no-caps
            :label="field ? 'Save' : 'Create'"
            type="submit"
            :loading="saving"
          />
        </div>
      </q-form>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";

import RecipientsEditor from "@/components/settings/RecipientsEditor.vue";
import { useCustomFieldsStore } from "@/stores/customFields";
import type { CustomField } from "@/types/core/customfields";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps<{
  modelValue: boolean;
  field: CustomField | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const store = useCustomFieldsStore();
const saving = ref(false);

interface DraftField {
  id: number;
  name: string;
  model: "agent" | "client" | "site";
  type: string;
  required: boolean;
  options: string[];
  default_value_string: string;
  default_value_bool: boolean;
  default_values_multiple: string[];
  hide_in_ui: boolean;
  hide_in_summary: boolean;
}

const empty = (): DraftField => ({
  id: 0,
  name: "",
  model: "agent",
  type: "text",
  required: false,
  options: [],
  default_value_string: "",
  default_value_bool: false,
  default_values_multiple: [],
  hide_in_ui: false,
  hide_in_summary: false,
});

const state = reactive<DraftField>(empty());

const modelOptions = [
  { value: "agent",  label: "Agent"  },
  { value: "client", label: "Client" },
  { value: "site",   label: "Site"   },
];
const typeOptions = [
  { value: "text",     label: "Text"     },
  { value: "number",   label: "Number"   },
  { value: "single",   label: "Single-select"   },
  { value: "multiple", label: "Multi-select"    },
  { value: "checkbox", label: "Checkbox" },
  { value: "datetime", label: "DateTime" },
];

watch(
  () => [props.modelValue, props.field],
  ([open, f]) => {
    if (open) {
      const src = (f as CustomField | null) ?? null;
      const e = empty();
      if (src) {
        e.id = src.id;
        e.name = src.name;
        e.model = src.model;
        e.type = src.type;
        e.required = src.required;
        e.options = [...(src.options ?? [])];
        e.default_value_string = src.default_value_string ?? "";
        e.default_value_bool = src.default_value_bool ?? false;
        e.default_values_multiple = [...(src.default_values_multiple ?? [])];
        e.hide_in_ui = src.hide_in_ui ?? false;
        e.hide_in_summary = src.hide_in_summary ?? false;
      }
      Object.assign(state, e);
    }
  },
  { immediate: true },
);

function close() { emit("update:modelValue", false); }

async function submit() {
  saving.value = true;
  try {
    // Strip the convenience id; backend only wants real fields.
    const payload: Partial<CustomField> = {
      name: state.name,
      model: state.model,
      type: state.type,
      required: state.required,
      options: state.options,
      default_value_string: state.default_value_string,
      default_value_bool: state.default_value_bool,
      default_values_multiple: state.default_values_multiple,
      hide_in_ui: state.hide_in_ui,
      hide_in_summary: state.hide_in_summary,
    };
    if (props.field) {
      await store.update(props.field.id, payload);
      notifySuccess("Custom field updated");
    } else {
      await store.create(payload);
      notifySuccess("Custom field created");
    }
    emit("saved");
    close();
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.cfd {
  height: 100%;
  display: flex; flex-direction: column;
}
.cfd__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-stroke-divider);
}
.cfd__title {
  font-size: var(--intune-font-size-500);
  font-weight: var(--intune-font-weight-semibold);
  margin: 0;
}
.cfd__form {
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto;
}
.cfd__foot {
  display: flex; gap: 8px; justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--color-stroke-divider);
  margin-top: auto;
}
</style>
