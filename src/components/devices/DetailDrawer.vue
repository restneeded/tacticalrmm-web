<!--
  DetailDrawer — side panel summary + link to legacy /agents/:id page.
  Phase C does NOT redesign the agent detail page; that's a future phase.
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right"
    overlay
    bordered
    :width="420"
    :breakpoint="0"
  >
    <div v-if="agent" class="dd">
      <header class="dd__head">
        <div>
          <StatusChip
            :tone="statusTone"
            :label="agent.status"
          />
          <h2 class="dd__title">{{ agent.hostname }}</h2>
          <div class="dd__sub">
            {{ agent.client_name }} · {{ agent.site_name }}
          </div>
        </div>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <dl class="dd__grid">
        <div><dt>Type</dt>           <dd>{{ agent.monitoring_type }}</dd></div>
        <div><dt>OS</dt>             <dd>{{ agent.operating_system || "—" }}</dd></div>
        <div><dt>Platform</dt>       <dd>{{ agent.plat }} / {{ agent.goarch }}</dd></div>
        <div><dt>Agent</dt>          <dd>{{ agent.version || "—" }}</dd></div>
        <div><dt>Public IP</dt>      <dd>{{ agent.public_ip || "—" }}</dd></div>
        <div><dt>Last seen</dt>      <dd>{{ agent.last_seen || "—" }}</dd></div>
        <div><dt>Logged user</dt>    <dd>{{ agent.logged_username || "—" }}</dd></div>
        <div><dt>Pending actions</dt><dd>{{ agent.pending_actions_count }}</dd></div>
        <div><dt>Failing checks</dt> <dd>{{ agent.checks?.failing ?? 0 }}</dd></div>
        <div><dt>Patches pending</dt><dd>{{ agent.has_patches_pending ? "Yes" : "No" }}</dd></div>
        <div><dt>Reboot pending</dt> <dd>{{ agent.needs_reboot ? "Yes" : "No" }}</dd></div>
        <div><dt>Maintenance</dt>    <dd>{{ agent.maintenance_mode ? "On" : "Off" }}</dd></div>
      </dl>

      <div class="dd__actions">
        <q-btn
          color="primary"
          unelevated
          icon-right="open_in_new"
          :to="`/devices/${agent.agent_id}`"
          target="_self"
          label="Open full agent page"
        />
      </div>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { AgentRow } from "@/api/devices";
import StatusChip from "@/components/devices/StatusChip.vue";

const props = defineProps<{
  modelValue: boolean;
  agent: AgentRow | null;
}>();
defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const statusTone = computed<"positive" | "warning" | "negative" | "neutral">(() => {
  const r = props.agent;
  if (!r) return "neutral";
  if (r.status === "overdue") return "negative";
  if (r.status === "offline") return "warning";
  if (r.status === "online")  return "positive";
  return "neutral";
});
</script>

<style lang="scss" scoped>
.dd {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  &__title {
    margin: 6px 0 2px 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: -0.2px;
  }
  &__sub {
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin: 0 0 20px 0;

    > div {
      display: flex;
      flex-direction: column;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-stroke-divider);
    }
    dt {
      font-size: var(--intune-font-size-100);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--color-fg-tertiary);
      margin-bottom: 2px;
    }
    dd {
      margin: 0;
      font-size: var(--intune-font-size-200);
      color: var(--color-fg-primary);
      word-break: break-word;
    }
  }

  &__actions {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--color-stroke-divider);
  }
}
</style>
