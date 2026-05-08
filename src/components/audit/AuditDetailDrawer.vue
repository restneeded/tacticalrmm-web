<!--
  AuditDetailDrawer — Phase R. Read-only side drawer with the full audit
  payload. Shows before/after JSON, debug_info, and a deep-link to the
  agent (if applicable).
-->
<template>
  <q-drawer
    v-model="open"
    side="right"
    bordered
    :width="520"
    overlay
    behavior="desktop"
    @update:model-value="(v) => { if (!v) $emit('close'); }"
  >
    <div class="add">
      <header class="add__head">
        <div>
          <span class="add__pill">{{ row.action }}</span>
          <span class="add__obj">{{ row.object_type }}</span>
        </div>
        <q-btn flat round dense icon="close" @click="$emit('close')" aria-label="Close" />
      </header>

      <dl class="add__meta">
        <div><dt>When</dt><dd>{{ formatTime(row.entry_time) }}</dd></div>
        <div><dt>User</dt><dd>{{ row.username || "—" }}</dd></div>
        <div><dt>IP</dt><dd>{{ row.ip_address || "—" }}</dd></div>
        <div v-if="row.agent_id">
          <dt>Agent</dt>
          <dd>
            <router-link :to="`/devices/${row.agent_id}`" class="add__link">
              {{ row.agent || row.agent_id }}
            </router-link>
          </dd>
        </div>
        <div v-if="row.site">
          <dt>Site</dt>
          <dd>{{ row.site.name }}{{ row.site.client ? ` · ${row.site.client.name}` : "" }}</dd>
        </div>
      </dl>

      <section v-if="row.message" class="add__section">
        <h3>Message</h3>
        <p class="add__msg">{{ row.message }}</p>
      </section>

      <section v-if="row.before_value" class="add__section">
        <h3>Before</h3>
        <pre class="add__json">{{ formatJson(row.before_value) }}</pre>
      </section>

      <section v-if="row.after_value" class="add__section">
        <h3>After</h3>
        <pre class="add__json">{{ formatJson(row.after_value) }}</pre>
      </section>

      <section v-if="row.debug_info" class="add__section">
        <h3>Debug info</h3>
        <pre class="add__json">{{ formatJson(row.debug_info) }}</pre>
      </section>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

import type { AuditLogRow } from "@/api/audit";

const props = defineProps<{ row: AuditLogRow }>();
defineEmits<{ close: [] }>();

const open = ref(true);
watch(() => props.row, () => { open.value = true; });

function formatTime(s: string): string {
  return s ? new Date(s).toLocaleString() : "—";
}
function formatJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
</script>

<style lang="scss" scoped>
.add {
  padding: 16px 20px 32px;
  height: 100%;
  overflow-y: auto;
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
  }
  &__obj {
    margin-left: 8px;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-300);
  }
  &__meta {
    display: grid; grid-template-columns: 80px 1fr; gap: 4px 16px;
    margin: 0 0 16px 0;
    dt { color: var(--color-fg-tertiary); font-size: var(--intune-font-size-200); }
    dd { margin: 0; color: var(--color-fg-primary); font-size: var(--intune-font-size-300); }
  }
  &__section { margin-top: 16px;
    h3 {
      font-size: var(--intune-font-size-300);
      font-weight: var(--intune-font-weight-semibold);
      margin: 0 0 6px 0;
      color: var(--color-fg-secondary);
    }
  }
  &__msg {
    margin: 0; color: var(--color-fg-primary);
    font-size: var(--intune-font-size-300);
    white-space: pre-wrap; word-break: break-word;
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
  &__link {
    color: var(--color-fg-link, #2667c6);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
</style>
