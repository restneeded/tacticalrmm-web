<!--
  Phase T2 — URL Action add/edit drawer.
  Mirrors the Phase S ApiKeyFormDrawer / UserFormDrawer chrome.
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right" overlay bordered :width="540" :breakpoint="0"
  >
    <div class="uad">
      <header class="uad__head">
        <h2 class="uad__title">{{ action ? `Edit ${action.name}` : "Add URL action" }}</h2>
        <q-btn flat dense round icon="close" @click="close" />
      </header>

      <q-form @submit.prevent="submit" class="uad__form">
        <q-input
          outlined dense
          v-model="state.name"
          label="Name"
          :rules="[(v) => !!v || 'Required']"
          maxlength="255"
        />
        <q-input
          outlined dense
          v-model="state.desc"
          label="Description (optional)"
          autogrow
        />

        <q-btn-toggle
          v-model="state.action_type"
          :options="[
            { value: 'web',  label: 'Web',  icon: 'public' },
            { value: 'rest', label: 'REST', icon: 'cloud' },
          ]"
          outline no-caps dense
        />

        <q-select
          v-if="state.action_type === 'rest'"
          outlined dense
          v-model="state.rest_method"
          :options="['get','post','put','delete','patch']"
          label="REST method"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-input
          outlined dense
          v-model="state.pattern"
          label="URL pattern"
          hint="Supports {{agent.X}} / {{client.X}} / {{site.X}} substitutions."
          :rules="[(v) => !!v || 'Required']"
          autogrow
        />

        <template v-if="state.action_type === 'rest'">
          <q-input
            outlined dense type="textarea" rows="4"
            v-model="state.rest_headers"
            label="REST headers (one per line)"
            placeholder="Authorization: Bearer ..."
          />
          <q-input
            outlined dense type="textarea" rows="6"
            v-model="state.rest_body"
            label="REST body"
            placeholder='{"key": "value"}'
          />
        </template>

        <div class="uad__foot">
          <q-btn flat no-caps label="Cancel" @click="close" />
          <q-btn
            unelevated color="primary" no-caps
            :label="action ? 'Save' : 'Create'"
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

import { useURLActionsStore } from "@/stores/urlActions";
import type {
  URLAction,
  URLActionType,
  RESTMethodType,
} from "@/types/core/urlactions";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps<{
  modelValue: boolean;
  action: URLAction | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const store = useURLActionsStore();
const saving = ref(false);

const empty = (): URLAction => ({
  id: 0,
  name: "",
  desc: "",
  action_type: "web" as URLActionType,
  rest_method: "post" as RESTMethodType,
  pattern: "",
  rest_body: "",
  rest_headers: "",
});

const state = reactive<URLAction>(empty());

watch(
  () => [props.modelValue, props.action],
  ([open, a]) => {
    if (open) {
      const src = (a as URLAction | null) ?? empty();
      state.id = src.id;
      state.name = src.name;
      state.desc = src.desc ?? "";
      state.action_type = src.action_type;
      state.rest_method = src.rest_method;
      state.pattern = src.pattern;
      state.rest_body = src.rest_body ?? "";
      state.rest_headers = src.rest_headers ?? "";
    }
  },
  { immediate: true },
);

function close() { emit("update:modelValue", false); }

async function submit() {
  saving.value = true;
  try {
    const payload: URLAction = { ...state };
    if (props.action) {
      await store.update(props.action.id, payload);
      notifySuccess("URL action updated");
    } else {
      await store.create(payload);
      notifySuccess("URL action created");
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
.uad {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.uad__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-stroke-divider);
}
.uad__title {
  font-size: var(--intune-font-size-500);
  font-weight: var(--intune-font-weight-semibold);
  margin: 0;
}
.uad__form {
  padding: 16px 20px;
  display: flex; flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.uad__foot {
  display: flex; gap: 8px; justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--color-stroke-divider);
  margin-top: auto;
}
</style>
