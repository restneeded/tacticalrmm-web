<!--
  FleetStatsCard — agent last-seen distribution. Renders a stacked bar
  whose segments map to the buckets returned by /core/health/.
-->
<template>
  <article class="card" aria-label="Fleet stats">
    <header class="card__head">
      <q-icon name="devices" size="18px" class="card__icon" />
      <h2 class="card__title">Agent fleet</h2>
    </header>

    <div v-if="loading" class="card__placeholder">Loading…</div>

    <div v-else-if="health" class="card__body">
      <p class="card__subhead">Last seen distribution ({{ totalAgents }} agents)</p>
      <div v-if="totalAgents > 0" class="card__bar" aria-hidden="true">
        <div
          v-for="b in buckets"
          :key="b.key"
          class="card__bar-seg"
          :style="{ width: pct(b.value) + '%', background: b.color }"
          :title="`${b.label}: ${b.value}`"
        ></div>
      </div>
      <ul class="card__legend">
        <li v-for="b in buckets" :key="b.key" :style="{ '--seg-color': b.color }">
          {{ b.label }}<span>{{ b.value }}</span>
        </li>
      </ul>

      <h3 class="card__subhead">Recent activity (24h)</h3>
      <div class="card__row">
        <span class="card__row-name">Audit entries</span>
        <span class="card__row-value">{{ health.db.audit_logs_24h }}</span>
      </div>
      <div class="card__row">
        <span class="card__row-name">Debug — info</span>
        <span class="card__row-value">{{ health.debug_logs_24h.info }}</span>
      </div>
      <div class="card__row">
        <span class="card__row-name">Debug — warning</span>
        <span class="card__row-value">{{ health.debug_logs_24h.warning }}</span>
      </div>
      <div class="card__row">
        <span class="card__row-name">Debug — error</span>
        <span class="card__row-value">{{ health.debug_logs_24h.error }}</span>
      </div>
      <div class="card__row">
        <span class="card__row-name">Debug — critical</span>
        <span class="card__row-value">{{ health.debug_logs_24h.critical }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { DiagnosticsHealth } from "@/api/diagnostics";

const props = defineProps<{
  health: DiagnosticsHealth | null;
  loading: boolean;
}>();

const buckets = computed(() => {
  if (!props.health) return [];
  const f = props.health.fleet_last_seen;
  return [
    { key: "lt_1h",  label: "≤1h",      value: f.lt_1h,  color: "#10a060" },
    { key: "lt_24h", label: "≤24h",     value: f.lt_24h, color: "#3aa57a" },
    { key: "lt_7d",  label: "≤7d",      value: f.lt_7d,  color: "#7caa3a" },
    { key: "lt_30d", label: "≤30d",     value: f.lt_30d, color: "#d49432" },
    { key: "older",  label: "Older",    value: f.older,  color: "#c45c66" },
    { key: "never",  label: "Never",    value: f.never,  color: "#6e6e72" },
  ];
});

const totalAgents = computed(() =>
  buckets.value.reduce((s, b) => s + b.value, 0),
);

function pct(n: number): number {
  if (totalAgents.value === 0) return 0;
  return Math.round((n / totalAgents.value) * 1000) / 10;
}
</script>

<style lang="scss" scoped>
@import "./_diag-card";
</style>
