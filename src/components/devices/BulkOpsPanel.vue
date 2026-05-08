<!--
  Phase K — BulkOpsPanel.
  Shows the most recent /agents/bulk/jobs/ rows. Polls every 5s when at
  least one row is non-terminal; otherwise idle. Collapses by default
  unless there are non-terminal jobs.
-->
<template>
  <q-card v-if="rows.length > 0" flat bordered class="bop">
    <q-card-section
      class="bop__head"
      :class="{ 'bop__head--clickable': true }"
      @click="open = !open"
    >
      <q-icon :name="open ? 'expand_less' : 'expand_more'" />
      <span class="bop__title">Recent bulk operations</span>
      <q-chip dense color="primary" text-color="white" size="sm">
        {{ rows.length }}
      </q-chip>
      <q-space />
      <span v-if="anyRunning" class="bop__live">
        <q-spinner-dots size="14px" /> live
      </span>
      <q-btn
        flat
        dense
        round
        size="sm"
        icon="refresh"
        @click.stop="refresh"
        :loading="loading"
      >
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </q-card-section>

    <q-slide-transition>
      <div v-show="open">
        <q-separator />
        <table class="bop__table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Status</th>
              <th>Agents</th>
              <th>Message</th>
              <th>By</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td>{{ formatOp(r.op) }}</td>
              <td>
                <span class="bop__status" :class="`bop__status--${r.status}`">
                  {{ r.status }}
                </span>
              </td>
              <td class="bop__num">
                {{ r.dispatched_count }} / {{ r.total_agents }}
                <span v-if="r.failed_count" class="bop__failed">
                  ({{ r.failed_count }} failed)
                </span>
              </td>
              <td class="bop__msg" :title="r.message">{{ r.message || "—" }}</td>
              <td>{{ r.created_by || "—" }}</td>
              <td :title="r.created_at">{{ relTime(r.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </q-slide-transition>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { fetchBulkOpJobs, type BulkOpJobRow } from "@/api/devices";

const rows = ref<BulkOpJobRow[]>([]);
const loading = ref(false);
const open = ref(false);

const TERMINAL = new Set(["done", "partial", "failed"]);
const anyRunning = computed(() => rows.value.some((r) => !TERMINAL.has(r.status)));

let timer: ReturnType<typeof setInterval> | null = null;
let stopped = false;

async function refresh() {
  if (stopped) return;
  loading.value = true;
  try {
    rows.value = await fetchBulkOpJobs(25);
    // open by default if there's any live activity
    if (anyRunning.value) open.value = true;
  } catch (err) {
    // poll-stop on 4xx — same pattern as useAgentLiveStatus (Phase J)
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status && status >= 400 && status < 500) stopped = true;
  } finally {
    loading.value = false;
  }
}

function tickIfNeeded() {
  if (!stopped && anyRunning.value) void refresh();
}

onMounted(() => {
  void refresh();
  timer = setInterval(tickIfNeeded, 5000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function formatOp(op: string): string {
  return op
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
defineExpose({ refresh });
</script>

<style lang="scss" scoped>
.bop {
  margin-bottom: 12px;
  background: var(--color-bg-card);
  border-color: var(--color-border-default);

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;

    &--clickable:hover {
      background: var(--color-bg-subtle);
    }
  }
  &__title {
    font-weight: var(--intune-font-weight-semibold);
  }
  &__live {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
  }
  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--intune-font-size-200);

    th, td {
      padding: 6px 12px;
      text-align: left;
      border-bottom: 1px solid var(--color-border-subtle);
      vertical-align: middle;
    }
    th {
      font-weight: var(--intune-font-weight-medium);
      color: var(--color-fg-tertiary);
      background: var(--color-bg-subtle);
    }
    tbody tr:hover {
      background: var(--color-bg-subtle);
    }
  }
  &__num {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  &__failed {
    color: var(--color-status-error, #d13438);
    margin-left: 4px;
  }
  &__msg {
    max-width: 320px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &__status {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: var(--intune-font-weight-medium);
    text-transform: capitalize;

    &--done {
      background: rgba(15, 123, 15, 0.16);
      color: #107c10;
    }
    &--partial {
      background: rgba(244, 138, 0, 0.16);
      color: #c64c00;
    }
    &--failed {
      background: rgba(209, 52, 56, 0.16);
      color: #b32128;
    }
    &--dispatching, &--running {
      background: rgba(0, 120, 212, 0.16);
      color: #0078d4;
    }
  }
}
</style>
