<!--
  RecentErrorsCard — last error/critical entries from DebugLog.
  Sources from PATCH /logs/debug/. Filtered client-side to error/critical
  for compactness; the full debug log lives in /legacy for now.
-->
<template>
  <article class="card" aria-label="Recent system errors">
    <header class="card__head">
      <q-icon name="error_outline" size="18px" class="card__icon" />
      <h2 class="card__title">Recent errors</h2>
    </header>

    <div v-if="loading" class="card__placeholder">Loading…</div>

    <div v-else-if="rows.length === 0" class="card__placeholder">
      No errors in the recent debug log. 🎉
    </div>

    <ul v-else class="errs">
      <li v-for="r in rows" :key="r.id" class="errs__item">
        <span class="card__pill" :data-kind="toneFor(r.log_level)">{{ r.log_level }}</span>
        <div class="errs__body">
          <p class="errs__msg">{{ r.message }}</p>
          <p class="errs__meta">
            {{ r.log_type }}
            <span v-if="r.agent">· {{ r.agent }}</span>
            <span class="errs__time">{{ relativeTime(r.entry_time) }}</span>
          </p>
        </div>
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import { fetchDebugLogs, type DebugLogRow } from "@/api/diagnostics";

const rows = ref<DebugLogRow[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    // Pull last 1k entries; filter to error/critical for the card.
    const all = await fetchDebugLogs({});
    rows.value = all
      .filter(r => r.log_level === "error" || r.log_level === "critical")
      .slice(0, 8);
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function toneFor(lvl: string): "warn" | "neg" | "" {
  if (lvl === "critical") return "neg";
  if (lvl === "error")    return "warn";
  return "";
}

function relativeTime(t: string): string {
  if (!t) return "";
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)         return `${Math.round(diff)}s ago`;
  if (diff < 3600)       return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

onMounted(load);
</script>

<style lang="scss" scoped>
@import "./_diag-card";

.errs {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 10px;

  &__item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 8px 10px;
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
  }
  &__body { flex: 1; min-width: 0; }
  &__msg {
    margin: 0;
    color: var(--color-fg-primary);
    font-size: var(--intune-font-size-300);
    word-break: break-word;
  }
  &__meta {
    margin: 4px 0 0 0;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    display: flex; gap: 8px;
  }
  &__time { margin-left: auto; }
}
</style>
