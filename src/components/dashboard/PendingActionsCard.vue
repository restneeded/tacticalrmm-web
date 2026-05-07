<!-- PendingActionsCard — count of queued agent actions (script runs, reboots…). -->
<template>
  <DashboardCard
    title="Pending actions"
    icon="hourglass_top"
    :loading="loading"
    :error="error"
    :to="{ path: '/legacy' }"
    :accent="accent"
    aria-label="Pending agent actions"
  >
    <div class="pa">
      <span class="pa__num">{{ count }}</span>
      <span class="pa__label">
        {{ count === 1 ? "queued action" : "queued actions" }}
      </span>
    </div>
    <p class="pa__caption">
      <template v-if="count === 0">Nothing waiting on agent check-in.</template>
      <template v-else>Waiting for agents to pick them up.</template>
    </p>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchPendingActions } from "@/api/dashboard";

const loading = ref(true);
const error = ref<string | null>(null);
const count = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    error.value = null;
    const r = await fetchPendingActions();
    count.value = r.pending_actions_count;
  } catch (e) {
    error.value = "Could not load pending actions";
    // eslint-disable-next-line no-console
    console.error("[dashboard] pending actions:", e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => void load(), 60_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const accent = computed<"ok" | "warn" | undefined>(() => {
  if (count.value === 0) return undefined;
  return count.value >= 25 ? "warn" : "info";
});
</script>

<style lang="scss" scoped>
.pa {
  display: flex;
  align-items: baseline;
  gap: 10px;
  &__num {
    font-size: var(--intune-font-size-800);
    line-height: 1;
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-primary);
  }
  &__label {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
  }
  &__caption {
    margin: 8px 0 0 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
}
</style>
