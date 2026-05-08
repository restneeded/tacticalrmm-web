<!--
  PendingAlertsCard — count of unresolved/unsnoozed/un-hidden alerts,
  plus the most recent few. Source: PATCH /alerts/ {top: 5}.
-->
<template>
  <DashboardCard
    title="Pending alerts"
    icon="notifications_active"
    :loading="loading"
    :error="error"
    :to="{ path: '/alerts' }"
    :accent="accent"
    aria-label="Pending alerts"
  >
    <div class="alerts">
      <div class="alerts__count">
        <span class="alerts__num">{{ count }}</span>
        <span class="alerts__num-label">
          {{ count === 1 ? "open alert" : "open alerts" }}
        </span>
      </div>

      <ul v-if="alerts.length" class="alerts__list">
        <li
          v-for="alert in alerts"
          :key="alert.id"
          class="alerts__item"
          :data-severity="alert.severity"
        >
          <span class="alerts__dot" :data-severity="alert.severity" />
          <span class="alerts__msg">{{ alert.message || alertTitle(alert) }}</span>
          <time class="alerts__time" :datetime="alert.alert_time || ''">
            {{ relativeTime(alert.alert_time) }}
          </time>
        </li>
      </ul>
      <p v-else class="alerts__empty">All clear — no pending alerts.</p>
    </div>

    <template #footer>
      <span v-if="count > 5">Showing latest 5 of {{ count }}</span>
      <span v-else>Open the alerts panel to triage</span>
    </template>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchTopAlerts, type AlertRow } from "@/api/dashboard";

const loading = ref(true);
const error = ref<string | null>(null);
const count = ref(0);
const alerts = ref<AlertRow[]>([]);
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    error.value = null;
    const data = await fetchTopAlerts(5);
    count.value = data.alerts_count;
    alerts.value = data.alerts;
  } catch (e) {
    error.value = "Could not load alerts";
    // eslint-disable-next-line no-console
    console.error("[dashboard] alerts:", e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  // refresh every 30s; cheap call (bounded to top 5)
  timer = setInterval(() => void load(), 30_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const accent = computed<"ok" | "warn" | "danger" | undefined>(() => {
  if (count.value === 0) return "ok";
  const hasError = alerts.value.some((a) => a.severity === "error");
  if (hasError || count.value >= 10) return "danger";
  return "warn";
});

function alertTitle(a: AlertRow): string {
  const parts: string[] = [];
  if (a.alert_type) parts.push(a.alert_type);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const named = (a as any).hostname || (a as any).agent || "";
  if (named) parts.push(String(named));
  return parts.join(" · ") || "Alert";
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
</script>

<style lang="scss" scoped>
.alerts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  &__count {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
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
    gap: 6px;
  }
  &__item {
    display: grid;
    grid-template-columns: 8px 1fr auto;
    align-items: center;
    column-gap: 10px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-secondary);
    padding: 4px 0;
    border-top: 1px solid var(--color-stroke-divider);
    &:first-child { border-top: none; }
  }
  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--intune-status-info);
    &[data-severity="error"]   { background-color: var(--intune-status-danger); }
    &[data-severity="warning"] { background-color: var(--intune-status-warning); }
    &[data-severity="info"]    { background-color: var(--intune-status-info); }
  }
  &__msg {
    color: var(--color-fg-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__time {
    font-variant-numeric: tabular-nums;
    color: var(--color-fg-tertiary);
  }
  &__empty {
    margin: 0;
    color: var(--intune-status-success);
    font-size: var(--intune-font-size-300);
  }
}
</style>
