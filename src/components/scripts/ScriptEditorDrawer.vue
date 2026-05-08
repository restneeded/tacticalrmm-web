<!--
  ScriptEditorDrawer — slim wrapper that puts ScriptEditor in a right-
  side maximized dialog. The drawer + the page wrapper render the same
  underlying ScriptEditor so behaviour is identical.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    position="right"
    maximized
    persistent
  >
    <ScriptEditor
      :script-id="scriptId"
      layout="drawer"
      @saved="onSaved"
      @deleted="onDeleted"
      @close="$emit('update:modelValue', false)"
    />
  </q-dialog>
</template>

<script setup lang="ts">
import ScriptEditor from "./ScriptEditor.vue";

defineProps<{ modelValue: boolean; scriptId: number | null }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved", id: number): void;
  (e: "deleted", id: number): void;
}>();

function onSaved(id: number) { emit("saved", id); }
function onDeleted(id: number) { emit("deleted", id); emit("update:modelValue", false); }
</script>
