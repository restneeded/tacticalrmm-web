<!--
  ClientsOverviewCard — clients & sites count + agents per client + which clients
  have failing checks. Source: GET /clients/.
-->
<template>
  <DashboardCard
    title="Clients & sites"
    icon="business"
    :loading="loading"
    :error="error"
    :to="{ path: '/legacy' }"
    :accent="accent"
    aria-label="Clients and sites overview"
  >
    <div class="clients">
      <div class="clients__stats">
        <Stat label="Clients"  :value="clientCount" />
        <Stat label="Sites"    :value="siteCount" />
        <Stat label="Agents"   :value="totalAgents" />
      </div>

      <div v-if="failing.length" class="clients__failing">
        <span class="clients__fail-label">Failing checks at:</span>
        <ul class="clients__fail-list">
          <li v-for="c in failing" :key="c.id" class="clients__fail-item">
            {{ c.name }}
          </li>
        </ul>
      </div>
      <p v-else-if="clientCount > 0" class="clients__ok">All clients green.</p>
      <p v-else class="clients__empty">No clients configured yet.</p>
    </div>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, type FunctionalComponent } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchClientsOverview, type ClientSummary } from "@/api/dashboard";

const loading = ref(true);
const error = ref<string | null>(null);
const clients = ref<ClientSummary[]>([]);

async function load() {
  try {
    error.value = null;
    clients.value = await fetchClientsOverview();
  } catch (e) {
    error.value = "Could not load clients";
    // eslint-disable-next-line no-console
    console.error("[dashboard] clients:", e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const clientCount = computed(() => clients.value.length);
const siteCount = computed(() =>
  clients.value.reduce((acc, c) => acc + (c.sites?.length || 0), 0),
);
const totalAgents = computed(() =>
  clients.value.reduce((acc, c) => acc + (c.agent_count || 0), 0),
);
const failing = computed(() =>
  clients.value.filter((c) =>
    (c.sites || []).some(
      (s) => s.failing_checks?.error || s.failing_checks?.warning,
    ),
  ),
);

const accent = computed<"ok" | "warn" | undefined>(() => {
  if (clientCount.value === 0) return undefined;
  return failing.value.length > 0 ? "warn" : "ok";
});

// Tiny stat sub-component, defined inline to keep this file self-contained.
const Stat: FunctionalComponent<{ label: string; value: number }> = (props) =>
  h("div", { class: "stat" }, [
    h("div", { class: "stat__value" }, props.value),
    h("div", { class: "stat__label" }, props.label),
  ]);
Stat.props = ["label", "value"];
</script>

<style lang="scss" scoped>
.clients {
  display: flex;
  flex-direction: column;
  gap: 10px;
  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  &__failing {
    border-top: 1px solid var(--color-stroke-divider);
    padding-top: 8px;
  }
  &__fail-label {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  &__fail-list {
    list-style: none;
    margin: 4px 0 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  &__fail-item {
    font-size: var(--intune-font-size-200);
    background-color: rgba(247, 99, 12, 0.12);
    color: var(--intune-status-warning);
    padding: 2px 8px;
    border-radius: var(--intune-radius-circular);
  }
  &__ok {
    margin: 0;
    font-size: var(--intune-font-size-200);
    color: var(--intune-status-success);
  }
  &__empty {
    margin: 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
}

:deep(.stat) {
  &__value {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.05;
    color: var(--color-fg-primary);
  }
  &__label {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-top: 2px;
  }
}
</style>
