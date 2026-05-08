<!--
  PendingPatchesCard — count of pending Windows updates across the fleet.
  Source: GET /winupdate/fleet/stats/ (Phase Q).
-->
<template>
  <DashboardCard
    title="Pending updates"
    icon="system_update"
    :loading="loading"
    :error="error"
    :to="{ path: '/patching' }"
    :accent="accent"
    aria-label="Pending Windows updates"
  >
    <div class="pp">
      <div class="pp__count">
        <span class="pp__num">{{ totals.pending }}</span>
        <span class="pp__num-label">
          {{ totals.pending === 1 ? "agent with pending updates" : "agents with pending updates" }}
        </span>
      </div>

      <ul v-if="severityList.length" class="pp__list">
        <li v-for="s in severityList" :key="s.label" class="pp__row">
          <span class="pp__dot" :data-tone="s.tone" />
          <span class="pp__label">{{ s.label }}</span>
          <span class="pp__qty">{{ s.count }}</span>
        </li>
      </ul>
      <p v-else class="pp__empty">Fleet patch posture clean — nothing pending.</p>
    </div>

    <template #footer>
      <span v-if="totals.unscanned">{{ totals.unscanned }} agents have never reported a scan</span>
      <span v-else>Open the patching panel to act</span>
    </template>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchFleetStats } from "@/api/patching";

const loading = ref(true);
const error = ref<string | null>(null);
const totals = ref({
  total_agents: 0,
  up_to_date: 0,
  pending: 0,
  unscanned: 0,
  stale_pending: 0,
});
const severities = ref({
  Critical: 0,
  Important: 0,
  Moderate: 0,
  Low: 0,
  Optional: 0,
});
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    error.value = null;
    const data = await fetchFleetStats();
    totals.value = data.totals;
    severities.value = data.severity_breakdown;
  } catch (e) {
    error.value = "Could not load patch stats";
    // eslint-disable-next-line no-console
    console.error("[dashboard] patches:", e);
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

const severityList = computed(() => {
  const buckets: Array<{ label: string; tone: string; count: number }> = [
    { label: "Critical",  tone: "danger",  count: severities.value.Critical },
    { label: "Important", tone: "warning", count: severities.value.Important },
    { label: "Moderate",  tone: "info",    count: severities.value.Moderate },
    { label: "Low",       tone: "muted",   count: severities.value.Low },
  ];
  return buckets.filter((b) => b.count > 0);
});

const accent = computed<"ok" | "warn" | "danger" | undefined>(() => {
  if (totals.value.pending === 0) return "ok";
  if (severities.value.Critical > 0 || totals.value.stale_pending > 0) return "danger";
  return "warn";
});
</script>

<style lang="scss" scoped>
.pp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  &__count { display: flex; align-items: baseline; gap: 8px; }
  &__num {
    font-size: var(--intune-font-size-800);
    line-height: 1;
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-primary);
  }
  &__num-label {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
  }
  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  &__row {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    align-items: center;
    column-gap: 10px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-secondary);
    padding: 3px 0;
    border-top: 1px solid var(--color-stroke-divider);
    &:first-child { border-top: none; }
  }
  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--intune-status-info);
    &[data-tone="danger"]  { background-color: var(--intune-status-danger); }
    &[data-tone="warning"] { background-color: var(--intune-status-warning); }
    &[data-tone="info"]    { background-color: var(--intune-status-info); }
    &[data-tone="muted"]   { background-color: var(--color-fg-tertiary, #888); }
  }
  &__label { color: var(--color-fg-primary); }
  &__qty { font-variant-numeric: tabular-nums; color: var(--color-fg-tertiary); }
  &__empty {
    margin: 0;
    color: var(--intune-status-success);
    font-size: var(--intune-font-size-300);
  }
}
</style>
