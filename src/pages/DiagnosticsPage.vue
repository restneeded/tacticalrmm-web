<!--
  DiagnosticsPage — Phase R /diagnostics route under AppShell.

  Multi-section dashboard layout (NOT tabs, per the brief): TRMM core,
  services & probes, fleet, recent errors. Polls /core/health/ every 30s
  while visible. Each section degrades gracefully when its underlying
  endpoint reports nulls (e.g. systemctl unavailable inside docker dev).
-->
<template>
  <q-page class="dgp">
    <header class="dgp__hero">
      <div>
        <h1 class="dgp__title">Diagnostics</h1>
        <p class="dgp__lede">
          Health and runtime state of the TRMM control plane and the agent
          fleet. Use this page when something looks broken to confirm what
          actually is.
        </p>
      </div>
      <div class="dgp__hero-meta">
        <span v-if="loading" class="dgp__sync"><q-spinner-dots size="14px" /> syncing</span>
        <span v-else-if="lastUpdated" class="dgp__sync">
          updated {{ relativeTime(lastUpdated) }}
        </span>
        <q-btn flat dense icon="refresh" color="primary" @click="reload" aria-label="Refresh" />
      </div>
    </header>

    <div v-if="error && !health" class="dgp__error" role="alert">
      <q-icon name="warning" size="18px" /> {{ error }}
    </div>

    <div class="dgp__grid">
      <CoreHealthCard
        :health="health"
        :loading="!health && loading"
      />
      <ServicesHealthCard
        :health="health"
        :loading="!health && loading"
      />
      <FleetStatsCard
        :health="health"
        :loading="!health && loading"
      />
      <RecentErrorsCard />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { fetchHealth, type DiagnosticsHealth } from "@/api/diagnostics";

import CoreHealthCard     from "@/components/diagnostics/CoreHealthCard.vue";
import ServicesHealthCard from "@/components/diagnostics/ServicesHealthCard.vue";
import FleetStatsCard     from "@/components/diagnostics/FleetStatsCard.vue";
import RecentErrorsCard   from "@/components/diagnostics/RecentErrorsCard.vue";

const health = ref<DiagnosticsHealth | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<string | null>(null);

let pollHandle: number | null = null;

async function load() {
  loading.value = true;
  try {
    error.value = null;
    health.value = await fetchHealth();
    lastUpdated.value = new Date().toISOString();
  } catch (e) {
    error.value = "Could not load diagnostics. Polling paused.";
    // eslint-disable-next-line no-console
    console.error("[diagnostics] load:", e);
  } finally {
    loading.value = false;
  }
}

function reload() { void load(); }

function startPoll() {
  stopPoll();
  pollHandle = window.setInterval(() => {
    if (document.hidden) return;
    void load();
  }, 30_000);
}
function stopPoll() {
  if (pollHandle !== null) { window.clearInterval(pollHandle); pollHandle = null; }
}

function relativeTime(t: string): string {
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.round(diff)}s ago`;
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  return d.toLocaleTimeString();
}

onMounted(() => { void load(); startPoll(); });
onUnmounted(() => stopPoll());
</script>

<style lang="scss" scoped>
.dgp {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 24px;
    margin-bottom: 12px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    max-width: 720px; margin: 0;
  }
  &__hero-meta {
    display: flex; align-items: center; gap: 10px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
  &__sync { display: inline-flex; align-items: center; gap: 6px; }
  &__error {
    display: flex; align-items: center; gap: 8px;
    background: rgba(232, 68, 86, 0.1);
    border: 1px solid rgba(232, 68, 86, 0.4);
    color: #b32d3d;
    padding: 10px 14px;
    border-radius: var(--intune-radius-medium);
    margin: 8px 0 16px;
    font-size: var(--intune-font-size-300);
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 16px;
    margin-top: 8px;
  }
}
</style>
