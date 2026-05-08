<!--
  AgentDetailPage — Phase J spike stub.

  Routes at /devices/:agent_id under AppShell. Mounts the
  useAgentLiveStatus composable so we can verify the spike wires up.

  The full Intune-style hero + tab strip (Overview / Hardware / Software /
  Scripts / Automation / Patches / History / Notes) is the next slice of
  Phase J — gated behind Rest's go-ahead at the split point.
-->
<template>
  <div class="agent-detail">
    <header class="agent-detail__bar">
      <q-btn
        flat
        dense
        icon="arrow_back"
        label="Devices"
        no-caps
        :to="{ name: 'Devices' }"
      />
      <q-space />
      <q-btn
        flat
        dense
        icon="refresh"
        label="Refresh"
        no-caps
        :loading="loading"
        @click="refresh()"
      />
    </header>

    <section class="agent-detail__hero">
      <div v-if="loading && !status" class="agent-detail__loading">
        <q-circular-progress indeterminate size="32px" color="primary" />
        <span>Loading agent…</span>
      </div>

      <div v-else-if="error && !status" class="agent-detail__error">
        <q-icon name="error_outline" size="24px" />
        <div>
          <strong>Couldn't load agent</strong>
          <p>{{ errorLabel }}</p>
        </div>
      </div>

      <div v-else-if="!status" class="agent-detail__empty">
        <q-icon name="search_off" size="32px" />
        <p>No agent found for ID <code>{{ route.params.agent_id }}</code>.</p>
      </div>

      <div v-else class="agent-detail__summary">
        <h1 class="agent-detail__title">{{ status.hostname || "—" }}</h1>
        <div class="agent-detail__sub">
          {{ status.client || "—" }} · {{ status.siteName || "—" }} ·
          {{ status.operatingSystem || "—" }} ·
          Agent v{{ status.version || "—" }}
        </div>
        <div class="agent-detail__chips">
          <span class="chip" :class="`chip--${statusTone}`">
            {{ status.status || "unknown" }}
          </span>
          <span v-if="stale" class="chip chip--neutral">stale</span>
          <span v-if="status.maintenanceMode" class="chip chip--neutral">maintenance</span>
        </div>
      </div>
    </section>

    <!-- Spike-only debug surface. Removed when tabs land. -->
    <section v-if="status" class="agent-detail__debug">
      <details>
        <summary>Live status payload (Phase J spike)</summary>
        <pre>{{ debugView }}</pre>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import { useRoute } from "vue-router";
import { useAgentLiveStatus } from "@/composables/useAgentLiveStatus";

const route = useRoute();
const agentId = toRef(() => String(route.params.agent_id ?? ""));
// Destructure so refs are exposed as top-level bindings — Vue auto-unwraps
// these in the template, no `.value` needed.
const { status, loading, error, stale, refresh } = useAgentLiveStatus(agentId);

const statusTone = computed(() => {
  const s = status.value?.status;
  if (s === "online") return "positive";
  if (s === "offline") return "warning";
  if (s === "overdue") return "negative";
  return "neutral";
});

const errorLabel = computed(() => {
  const e = error.value as
    | {
        response?: { data?: { detail?: string } };
        message?: string;
      }
    | null;
  if (!e) return "";
  return (
    e.response?.data?.detail ||
    e.message ||
    "Request failed"
  );
});

const debugView = computed(() => JSON.stringify(status.value, null, 2));
</script>

<style lang="scss" scoped>
.agent-detail {
  padding: 16px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--color-bg-page);
  color: var(--color-fg-primary);
  min-height: 100%;

  &__bar {
    display: flex;
    align-items: center;
  }

  &__hero {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 20px 24px;
  }

  &__loading,
  &__error,
  &__empty {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    color: var(--color-fg-secondary);
  }

  &__title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }

  &__sub {
    margin-top: 4px;
    font-size: 13px;
    color: var(--color-fg-secondary);
  }

  &__chips {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  &__debug {
    background: var(--color-bg-surface);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 12px;
    color: var(--color-fg-secondary);

    pre {
      margin: 8px 0 0;
      max-height: 320px;
      overflow: auto;
      background: var(--color-bg-page);
      border-radius: 6px;
      padding: 12px;
    }
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--negative {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
