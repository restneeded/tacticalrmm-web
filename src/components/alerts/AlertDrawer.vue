<!--
  AlertDrawer — Phase P side drawer for inspecting one Alert.

  Opened by AlertsActiveTab on row-click. Shows the full message, the
  related agent / check / task with deep links into the existing detail
  pages, the action stdout/stderr if a script ran, and quick actions
  (resolve, snooze 1d, hide).
-->
<template>
  <q-drawer
    v-model="model"
    side="right"
    overlay bordered
    :width="480"
    behavior="mobile"
    class="adr"
  >
    <div v-if="alert" class="adr__inner">
      <header class="adr__hdr">
        <div class="adr__hdr-top">
          <SeverityChip :severity="alert.severity" />
          <span class="adr__type">{{ typeLabel(alert.alert_type) }}</span>
          <q-space />
          <q-btn flat round dense icon="close" @click="model = false" />
        </div>
        <h2 class="adr__title">{{ alert.message || "Alert" }}</h2>
        <div class="adr__meta">
          Fired {{ formatTime(alert.alert_time) }}
          <span v-if="alert.agent_id">·
            <a :href="`/devices/${alert.agent_id}`" class="adr__link">
              {{ alert.hostname }}
            </a>
          </span>
        </div>
      </header>

      <section class="adr__sec">
        <h3 class="adr__sec-title">Status</h3>
        <ul class="adr__kvs">
          <li><span>Resolved</span><b>{{ alert.resolved ? "Yes" : "No" }}</b></li>
          <li v-if="alert.resolved_on"><span>Resolved at</span><b>{{ formatTime(alert.resolved_on) }}</b></li>
          <li><span>Snoozed</span><b>{{ alert.snoozed ? "Yes" : "No" }}</b></li>
          <li v-if="alert.snooze_until"><span>Snooze until</span><b>{{ formatTime(alert.snooze_until) }}</b></li>
          <li><span>Hidden</span><b>{{ alert.hidden ? "Yes" : "No" }}</b></li>
          <li><span>Email sent</span><b>{{ alert.email_sent ? formatTime(alert.email_sent) : "—" }}</b></li>
          <li><span>SMS sent</span><b>{{ alert.sms_sent ? formatTime(alert.sms_sent) : "—" }}</b></li>
        </ul>
      </section>

      <section v-if="alert.client || alert.site" class="adr__sec">
        <h3 class="adr__sec-title">Context</h3>
        <ul class="adr__kvs">
          <li v-if="alert.client"><span>Client</span><b>{{ alert.client }}</b></li>
          <li v-if="alert.site"><span>Site</span><b>{{ alert.site }}</b></li>
          <li v-if="alert.assigned_check"><span>Check id</span><b>{{ alert.assigned_check }}</b></li>
          <li v-if="alert.assigned_task"><span>Task id</span><b>{{ alert.assigned_task }}</b></li>
        </ul>
      </section>

      <section v-if="alert.action_run" class="adr__sec">
        <h3 class="adr__sec-title">Action ran</h3>
        <ul class="adr__kvs">
          <li><span>At</span><b>{{ formatTime(alert.action_run) }}</b></li>
          <li><span>Return code</span><b>{{ alert.action_retcode ?? "—" }}</b></li>
          <li v-if="alert.action_execution_time"><span>Duration</span><b>{{ alert.action_execution_time }}</b></li>
        </ul>
        <details v-if="alert.action_stdout" class="adr__details">
          <summary>stdout</summary>
          <pre class="adr__pre">{{ alert.action_stdout }}</pre>
        </details>
        <details v-if="alert.action_stderr" class="adr__details">
          <summary>stderr</summary>
          <pre class="adr__pre">{{ alert.action_stderr }}</pre>
        </details>
      </section>

      <footer class="adr__actions">
        <q-btn unelevated color="primary" icon="check" label="Resolve" no-caps
               @click="$emit('resolved', alert.id)" />
        <q-btn flat icon="snooze" label="Snooze 1d" no-caps
               @click="$emit('snoozed', alert.id)" />
        <q-btn flat icon="visibility_off" label="Hide" no-caps
               @click="$emit('hidden', alert.id)" />
      </footer>
    </div>
  </q-drawer>
</template>

<script setup>
import { computed } from "vue";

import SeverityChip from "@/components/alerts/SeverityChip.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  alert: { type: Object, default: null },
});
const emit = defineEmits(["update:modelValue", "resolved", "snoozed", "hidden"]);

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

function formatTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function typeLabel(t) {
  switch (t) {
    case "availability": return "Agent";
    case "check": return "Check";
    case "task": return "Task";
    default: return t || "Alert";
  }
}
</script>

<style lang="scss" scoped>
.adr {
  &__inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-surface);
  }

  &__hdr {
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--color-stroke-divider);
    background: var(--color-bg-surface);

    &-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
  }

  &__type { color: var(--color-fg-secondary); font-size: 12px; text-transform: capitalize; }

  &__title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px;
    color: var(--color-fg-primary);
    line-height: 1.3;
  }

  &__meta { color: var(--color-fg-secondary); font-size: 12px; }
  &__link { color: var(--color-brand-rest); text-decoration: none; &:hover { text-decoration: underline; } }

  &__sec {
    padding: 14px 18px;
    border-bottom: 1px solid var(--color-stroke-divider);
    &-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-fg-tertiary);
      margin: 0 0 8px;
    }
  }

  &__kvs {
    list-style: none;
    margin: 0; padding: 0;
    li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      padding: 4px 0;
      span { color: var(--color-fg-secondary); }
      b    { color: var(--color-fg-primary); font-weight: 500; }
    }
  }

  &__details {
    margin-top: 8px;
    summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--color-fg-secondary);
      padding: 4px 0;
    }
  }

  &__pre {
    font-size: 11px;
    background: var(--color-bg-surface-2);
    padding: 8px;
    border-radius: 4px;
    max-height: 200px;
    overflow: auto;
    color: var(--color-fg-primary);
    white-space: pre-wrap;
    word-break: break-all;
    margin: 4px 0 0;
  }

  &__actions {
    margin-top: auto;
    padding: 12px 18px;
    border-top: 1px solid var(--color-stroke-divider);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    background: var(--color-bg-surface);
  }
}
</style>
