<!--
  ChipSelect — a chip that opens a small menu of options. Used by the
  DevicesFilterBar for Type / Status / OS / Client / Site filters. Stays
  visually consistent with the boolean toggle chips next to it.
-->
<template>
  <q-chip
    clickable
    :selected="isSelected"
    :icon="icon"
    outline
    size="md"
    class="chip-select"
  >
    <span>{{ label }}: <b>{{ activeLabel }}</b></span>
    <q-icon name="arrow_drop_down" size="20px" class="chip-select__caret" />
    <q-menu fit anchor="bottom left" self="top left">
      <q-list dense>
        <q-item
          v-for="opt in displayOptions"
          :key="String(opt.value)"
          clickable
          v-close-popup
          @click="select(opt.value)"
          :active="isOptActive(opt.value)"
        >
          <q-item-section>{{ opt.label }}</q-item-section>
          <q-item-section side v-if="isOptActive(opt.value)">
            <q-icon name="check" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Opt {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}
const props = defineProps<{
  label: string;
  icon?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelValue: any;
  options: Opt[];
  nullable?: boolean;     // adds an "All" sentinel that maps to null
}>();
const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e: "update:modelValue", v: any): void;
}>();

const displayOptions = computed<Opt[]>(() => {
  if (props.nullable) return [{ label: "All", value: null }, ...props.options];
  return props.options;
});

const isSelected = computed(() => {
  if (props.nullable) return props.modelValue !== null;
  return props.modelValue !== "all" && props.modelValue !== undefined;
});

const activeLabel = computed(() => {
  const m = displayOptions.value.find((o) => o.value === props.modelValue);
  return m ? m.label : String(props.modelValue ?? "All");
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isOptActive(v: any) {
  return props.modelValue === v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function select(v: any) {
  emit("update:modelValue", v);
}
</script>

<style lang="scss" scoped>
.chip-select {
  cursor: pointer;
  user-select: none;
  &__caret {
    margin-left: 2px;
    margin-right: -4px;
  }
}
</style>
