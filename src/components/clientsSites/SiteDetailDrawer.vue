<!--
  Site detail side drawer — read-only summary + edit/delete actions + link
  to the legacy /agents/:id page is N/A here (this is per-site, not per-agent).
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
    <div v-if="row" class="sdd">
      <header class="sdd__head">
        <div>
          <div class="sdd__crumb">{{ row.client_name }}</div>
          <h2 class="sdd__title">{{ row.site_name }}</h2>
        </div>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <dl class="sdd__grid">
        <div><dt>Total agents</dt>     <dd>{{ row.agent_count }}</dd></div>
        <div><dt>Workstations</dt>      <dd>{{ row.workstations_online }} / {{ row.workstations_total }} online</dd></div>
        <div><dt>Servers</dt>           <dd>{{ row.servers_online }} / {{ row.servers_total }} online</dd></div>
        <div><dt>Failing checks</dt>    <dd>{{ row.failing_checks }}</dd></div>
        <div><dt>Patches pending</dt>   <dd>{{ row.patches_pending }}</dd></div>
        <div><dt>Last check-in</dt>     <dd>{{ row.last_seen || "—" }}</dd></div>
        <div><dt>Maintenance</dt>       <dd>{{ row.maintenance_mode ? "On" : "Off" }}</dd></div>
      </dl>

      <div class="sdd__actions">
        <q-btn
          color="primary"
          unelevated
          icon="edit"
          label="Edit site"
          @click="$emit('edit')"
        />
        <q-btn
          flat
          color="negative"
          icon="delete"
          label="Delete site"
          @click="$emit('delete')"
        />
      </div>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import type { SiteRow } from "@/components/clientsSites/columns";

defineProps<{
  modelValue: boolean;
  row: SiteRow | null;
}>();
defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "edit"): void;
  (e: "delete"): void;
}>();
</script>

<style lang="scss" scoped>
.sdd {
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
  &__crumb {
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
  }
  &__title {
    margin: 4px 0 0 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: -0.2px;
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
    display: flex;
    gap: 8px;
  }
}
</style>
