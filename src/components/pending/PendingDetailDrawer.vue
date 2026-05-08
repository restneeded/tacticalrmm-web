<!-- PendingDetailDrawer — Phase R. Action JSON + cancel button. -->
<template>
  <q-drawer
    v-model="open"
    side="right"
    bordered
    :width="480"
    overlay
    behavior="desktop"
    @update:model-value="(v) => { if (!v) $emit('close'); }"
  >
    <div class="pdd">
      <header class="pdd__head">
        <div>
          <span class="pdd__pill" :data-kind="row.status">{{ row.status }}</span>
          <span class="pdd__type">{{ formatActionType(row.action_type) }}</span>
        </div>
        <q-btn flat round dense icon="close" @click="$emit('close')" aria-label="Close" />
      </header>

      <dl class="pdd__meta">
        <div><dt>Agent</dt>
          <dd>
            <router-link
              v-if="row.agent_id"
              :to="`/devices/${row.agent_id}`"
              class="pdd__link"
            >{{ row.hostname || row.agent_id }}</router-link>
            <span v-else>{{ row.hostname || "—" }}</span>
          </dd></div>
        <div v-if="row.client"><dt>Client</dt><dd>{{ row.client }}</dd></div>
        <div v-if="row.site"><dt>Site</dt><dd>{{ row.site }}</dd></div>
        <div><dt>Queued</dt><dd>{{ time(row.entry_time) }}</dd></div>
        <div><dt>Due</dt><dd>{{ row.due }}</dd></div>
      </dl>

      <section v-if="row.description" class="pdd__section">
        <h3>Description</h3>
        <p>{{ row.description }}</p>
      </section>

      <section v-if="row.details" class="pdd__section">
        <h3>Details</h3>
        <pre class="pdd__json">{{ formatJson(row.details) }}</pre>
      </section>

      <footer class="pdd__foot">
        <q-btn
          unelevated color="negative" no-caps
          :disable="row.status !== 'pending'"
          @click="$emit('cancel')"
        >Cancel action</q-btn>
      </footer>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

import { formatActionType, type PendingActionRow } from "@/api/pending";

const props = defineProps<{ row: PendingActionRow }>();
defineEmits<{ close: []; cancel: [] }>();

const open = ref(true);
watch(() => props.row, () => { open.value = true; });

function time(t: string) { return t ? new Date(t).toLocaleString() : "—"; }
function formatJson(v: unknown) { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
</script>

<style lang="scss" scoped>
.pdd {
  padding: 16px 20px 24px;
  height: 100%;
  display: flex; flex-direction: column;
  background: var(--color-bg-surface-1);

  &__head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }
  &__pill {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--intune-radius-circular);
    font-size: var(--intune-font-size-200);
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    color: var(--color-fg-secondary);
    text-transform: capitalize;
    &[data-kind="pending"]   { background: rgba( 32,128,232, 0.12); color: #1f5fbb; border-color: rgba(32,128,232, 0.4); }
    &[data-kind="completed"] { background: rgba( 16,160, 96, 0.14); color: #1c7a4d; border-color: rgba(16,160, 96, 0.4); }
  }
  &__type {
    margin-left: 8px;
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-300);
  }
  &__meta {
    display: grid; grid-template-columns: 80px 1fr; gap: 4px 16px;
    margin: 0 0 16px 0;
    dt { color: var(--color-fg-tertiary); font-size: var(--intune-font-size-200); }
    dd { margin: 0; color: var(--color-fg-primary); font-size: var(--intune-font-size-300); }
  }
  &__section { margin-top: 12px;
    h3 {
      font-size: var(--intune-font-size-300);
      font-weight: var(--intune-font-weight-semibold);
      margin: 0 0 6px 0;
      color: var(--color-fg-secondary);
    }
    p { margin: 0; color: var(--color-fg-primary); font-size: var(--intune-font-size-300); }
  }
  &__json {
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 10px 12px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-primary);
    max-height: 280px; overflow: auto;
    white-space: pre-wrap;
  }
  &__foot { margin-top: auto; padding-top: 16px; }
  &__link {
    color: var(--color-fg-link, #2667c6);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
</style>
