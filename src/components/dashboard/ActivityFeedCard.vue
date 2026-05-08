<!--
  ActivityFeedCard — recent agent history (script runs, command executions).
  Source: GET /agents/history/.
-->
<template>
  <DashboardCard
    title="Recent agent activity"
    icon="history"
    :loading="loading"
    :error="error"
    to="/audit"
    aria-label="Recent agent activity"
  >
    <ul v-if="rows.length" class="feed">
      <li v-for="r in rows" :key="r.id" class="feed__item">
        <span class="feed__type" :data-type="r.type">{{ typeLabel(r.type) }}</span>
        <span class="feed__cmd" :title="r.command">{{ r.command || "—" }}</span>
        <span class="feed__by" v-if="r.username">{{ r.username }}</span>
        <time class="feed__time" :datetime="r.time">{{ relativeTime(r.time) }}</time>
      </li>
    </ul>
    <p v-else class="feed__empty">No recent activity yet.</p>

    <template #footer>
      <span v-if="rows.length">Last {{ rows.length }} events</span>
      <span v-else>Activity will appear here once agents check in.</span>
    </template>
  </DashboardCard>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchAgentHistory, type AgentHistoryRow } from "@/api/dashboard";

const loading = ref(true);
const error = ref<string | null>(null);
const rows = ref<AgentHistoryRow[]>([]);
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    error.value = null;
    rows.value = await fetchAgentHistory(8);
  } catch (e) {
    error.value = "Could not load activity";
    // eslint-disable-next-line no-console
    console.error("[dashboard] activity:", e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => void load(), 30_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function typeLabel(t: string): string {
  switch (t) {
    case "script_run": return "Script";
    case "cmd_run":    return "Command";
    case "agent_install": return "Install";
    case "agent_update":  return "Update";
    case "task_run":      return "Task";
    case "check_failure": return "Check";
    default: return (t || "Event").replace(/_/g, " ");
  }
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
.feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;

  &__item {
    display: grid;
    grid-template-columns: 64px 1fr auto auto;
    align-items: center;
    column-gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--color-stroke-divider);
    font-size: var(--intune-font-size-200);
    &:first-child { border-top: none; }
  }
  &__type {
    font-weight: var(--intune-font-weight-semibold);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.4px;
    padding: 2px 6px;
    border-radius: var(--intune-radius-circular);
    background-color: var(--color-bg-surface-2);
    color: var(--color-fg-secondary);
    text-align: center;
    &[data-type="check_failure"] {
      background-color: rgba(197, 15, 31, 0.12);
      color: var(--intune-status-danger);
    }
    &[data-type="script_run"], &[data-type="cmd_run"] {
      background-color: rgba(0, 120, 212, 0.12);
      color: var(--intune-status-info);
    }
  }
  &__cmd {
    color: var(--color-fg-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__by {
    color: var(--color-fg-tertiary);
    font-variant-numeric: tabular-nums;
  }
  &__time {
    color: var(--color-fg-tertiary);
    font-variant-numeric: tabular-nums;
  }
  &__empty {
    margin: 8px 0;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-300);
  }
}
</style>
