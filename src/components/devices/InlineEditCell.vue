<!--
  InlineEditCell — click to edit, Enter saves, Esc cancels, blur saves.
  Optimistic save is the parent's job; this component just emits.
-->
<template>
  <span
    v-if="!editing"
    class="iec"
    :class="{ 'iec--placeholder': !value }"
    @click="enter"
    role="button"
    :title="hint"
    tabindex="0"
    @keydown.enter.prevent="enter"
  >{{ value || placeholder }}<q-icon name="edit" size="14px" class="iec__icon" /></span>

  <q-input
    v-else
    ref="input"
    v-model="draft"
    dense
    outlined
    autofocus
    class="iec__input"
    @blur="commit"
    @keydown.enter.prevent="commit"
    @keydown.esc="cancel"
  />
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";

const props = defineProps<{
  value: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ (e: "save", v: string): void }>();

const editing = ref(false);
const draft = ref(props.value);
const hint = "Click to edit";

async function enter() {
  draft.value = props.value;
  editing.value = true;
  await nextTick();
}
function commit() {
  editing.value = false;
  if (draft.value !== props.value) emit("save", draft.value);
}
function cancel() {
  editing.value = false;
  draft.value = props.value;
}
</script>

<style lang="scss" scoped>
.iec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: text;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px dashed transparent;
  max-width: 100%;
  &:hover {
    border-color: var(--color-stroke-divider);
    background: var(--color-bg-elevated, rgba(0,0,0,0.03));
    .iec__icon { opacity: 0.7; }
  }
  &--placeholder {
    color: var(--color-fg-tertiary);
    font-style: italic;
  }
  &__icon {
    opacity: 0;
    transition: opacity 0.15s ease;
    color: var(--color-fg-tertiary);
  }
  &__input {
    min-width: 160px;
  }
}
</style>
