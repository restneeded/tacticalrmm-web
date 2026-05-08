<!--
  ScriptDetailPage — full-page wrapper for the editor.
  Used for /scripts/new and /scripts/:id when the user wants more room
  than the drawer offers, or when arriving from a deep link.
-->
<template>
  <q-page class="sdp">
    <header class="sdp__breadcrumbs">
      <q-btn flat dense icon="arrow_back" no-caps label="Scripts" @click="back" />
      <span class="sdp__sep">/</span>
      <span class="sdp__crumb">{{ scriptId === null ? "New script" : `Script #${scriptId}` }}</span>
    </header>

    <ScriptEditor
      :script-id="scriptId"
      layout="page"
      class="sdp__editor"
      @saved="onSaved"
      @deleted="onDeleted"
      @close="back"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import ScriptEditor from "@/components/scripts/ScriptEditor.vue";

const route  = useRoute();
const router = useRouter();

const scriptId = computed<number | null>(() => {
  const v = route.params.id;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
});

function back() {
  void router.push({ name: "Scripts" });
}

function onSaved() {
  // Stay on the page after a save; user can keep working. Toasts inside
  // the editor cover the feedback.
}
function onDeleted() {
  back();
}
</script>

<style lang="scss" scoped>
.sdp {
  display: flex; flex-direction: column;
  padding: 16px 24px 32px; max-width: 1600px; margin: 0 auto; gap: 8px;
  height: calc(100vh - 56px);

  &__breadcrumbs {
    display: flex; align-items: center; gap: 6px;
    color: var(--color-fg-secondary); font-size: 13px;
  }
  &__sep   { color: var(--color-fg-tertiary); }
  &__crumb { color: var(--color-fg-primary); font-weight: 600; }

  &__editor {
    flex: 1 1 auto; min-height: 0;
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-bg-surface);
  }
}
</style>
