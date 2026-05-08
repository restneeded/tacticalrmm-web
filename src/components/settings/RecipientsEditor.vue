<!--
  Phase T2 — small chip-list input for ArrayField fields
  (email_alert_recipients / sms_alert_recipients).
-->
<template>
  <div class="rec">
    <q-chip
      v-for="(item, idx) in modelValue"
      :key="`${item}-${idx}`"
      removable
      dense
      @remove="onRemove(idx)"
    >
      {{ item }}
    </q-chip>
    <q-input
      v-if="!readonly"
      outlined
      dense
      v-model="draft"
      :placeholder="placeholder"
      :type="type"
      class="rec__input"
      @keydown.enter.prevent="onAdd"
      @blur="onAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
  type?: string;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: string[]): void;
}>();

const draft = ref("");

function onAdd() {
  const v = draft.value.trim();
  if (!v) return;
  if (props.modelValue.includes(v)) {
    draft.value = "";
    return;
  }
  emit("update:modelValue", [...props.modelValue, v]);
  draft.value = "";
}

function onRemove(idx: number) {
  const next = [...props.modelValue];
  next.splice(idx, 1);
  emit("update:modelValue", next);
}
</script>

<style lang="scss" scoped>
.rec {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  &__input { min-width: 220px; flex: 0 1 240px; }
}
</style>
