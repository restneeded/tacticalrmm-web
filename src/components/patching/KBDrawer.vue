<!--
  KBDrawer — slide-in panel showing all agents that have a given KB,
  with bulk approve/ignore for that KB across the fleet.
-->
<template>
  <q-drawer
    :model-value="!!kb"
    side="right"
    :width="540"
    bordered
    overlay
    behavior="desktop"
    @update:model-value="onClose"
  >
    <div class="kbd">
      <header class="kbd__head">
        <div>
          <h2 class="kbd__title">{{ kb }}</h2>
          <SeverityBadge v-if="severity" :severity="severity" />
        </div>
        <q-btn flat round dense icon="close" @click="onClose(false)" />
      </header>

      <section class="kbd__actions">
        <q-btn flat dense no-caps icon="check" label="Approve all"
          :loading="busyOp === 'approve'"
          @click="onAction('approve')" />
        <q-btn flat dense no-caps icon="block" label="Ignore"
          :loading="busyOp === 'ignore'"
          @click="onAction('ignore')" />
        <q-btn flat dense no-caps icon="restart_alt" label="Reset"
          :loading="busyOp === 'nothing'"
          @click="onAction('nothing')" />
        <q-btn unelevated dense no-caps icon="download" label="Install on all"
          color="primary"
          :loading="busyOp === 'install'"
          @click="onInstall" />
      </section>

      <section class="kbd__list">
        <div v-if="loading && !rows.length" class="state">Loading agents…</div>
        <div v-else-if="!rows.length" class="state">No agents currently have this KB.</div>
        <ul v-else>
          <li v-for="r in rows" :key="r.agent_id">
            <RouterLink class="link"
              :to="{ name: 'DeviceDetail', params: { agent_id: r.agent_id }, query: { tab: 'patches' } }">
              {{ r.hostname }}
            </RouterLink>
            <span class="meta">
              {{ r.client || "—" }} · {{ r.site || "—" }}
              <span v-if="r.failed > 0" class="bad">{{ r.failed }} failed</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuasar } from "quasar";
import { RouterLink } from "vue-router";
import {
  bulkKBAction,
  bulkKBInstall,
  fetchFleetAgents,
  type FleetAgentRow,
} from "@/api/patching";
import SeverityBadge from "./SeverityBadge.vue";

const props = defineProps<{ kb: string | null; severity?: string | null }>();
const emit = defineEmits<{ (e: "close"): void; (e: "changed"): void }>();

const $q = useQuasar();
const rows = ref<FleetAgentRow[]>([]);
const loading = ref(false);
const busyOp = ref<string | null>(null);

watch(
  () => props.kb,
  (k) => {
    if (k) void load();
    else rows.value = [];
  },
  { immediate: true },
);

async function load() {
  if (!props.kb) return;
  loading.value = true;
  try {
    rows.value = await fetchFleetAgents({ kb: props.kb });
  } catch (err) {
    $q.notify({ type: "negative", message: msg(err), position: "top" });
  } finally {
    loading.value = false;
  }
}

async function onAction(action: "approve" | "ignore" | "nothing") {
  if (!props.kb) return;
  busyOp.value = action;
  try {
    const r = await bulkKBAction(props.kb, action);
    $q.notify({
      type: "positive",
      message: `${props.kb} → ${action} on ${r.affected_agents} agents.`,
      position: "top",
      timeout: 2500,
    });
    emit("changed");
    await load();
  } catch (err) {
    $q.notify({ type: "negative", message: msg(err), position: "top" });
  } finally {
    busyOp.value = null;
  }
}

async function onInstall() {
  if (!props.kb) return;
  busyOp.value = "install";
  try {
    const r = await bulkKBInstall(props.kb);
    $q.notify({
      type: "positive",
      message: `${props.kb} install dispatched to ${r.dispatched_agents} agents.`,
      position: "top",
      timeout: 3000,
    });
    emit("changed");
    await load();
  } catch (err) {
    $q.notify({ type: "negative", message: msg(err), position: "top" });
  } finally {
    busyOp.value = null;
  }
}

function onClose(open: boolean) {
  if (!open) emit("close");
}

function msg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}
</script>

<style lang="scss" scoped>
.kbd {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
  &__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--color-border-subtle);
    h2 { margin: 0 0 6px 0; font-size: 18px; font-weight: 600; }
  }
  &__actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      padding: 8px 8px;
      border-bottom: 1px solid var(--color-border-subtle);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta { font-size: 11px; color: var(--color-fg-secondary); }
  }
}
.state {
  text-align: center;
  padding: 32px;
  color: var(--color-fg-secondary);
}
.link { color: var(--color-fg-link, #0078d4); text-decoration: none; font-size: 13px; }
.bad {
  margin-left: 8px;
  background: var(--color-state-negative-bg, #fde7e9);
  color: var(--color-state-negative-fg, #a40e26);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
</style>
