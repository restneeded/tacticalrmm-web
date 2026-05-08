<!--
  PatchingOverviewTab — Phase Q fleet posture at-a-glance.

  Shows: stat tiles, severity breakdown, top-10 pending KBs, scan-failure list.
-->
<template>
  <div class="pov">
    <header class="pov__bar">
      <q-btn flat dense icon="refresh" :loading="loading" @click="load">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && !stats" class="pov__state">Loading fleet patch posture…</div>
    <div v-else-if="errorMsg && !stats" class="pov__state pov__state--error">
      Couldn't load stats: {{ errorMsg }}
    </div>

    <template v-if="stats">
      <section class="tiles">
        <div class="tile">
          <div class="tile__label">Total agents</div>
          <div class="tile__value">{{ stats.totals.total_agents }}</div>
        </div>
        <div class="tile tile--ok">
          <div class="tile__label">Up to date</div>
          <div class="tile__value">{{ stats.totals.up_to_date }}</div>
        </div>
        <div class="tile tile--warn">
          <div class="tile__label">Pending updates</div>
          <div class="tile__value">{{ stats.totals.pending }}</div>
        </div>
        <div class="tile">
          <div class="tile__label">Never scanned</div>
          <div class="tile__value">{{ stats.totals.unscanned }}</div>
        </div>
        <div class="tile tile--neg">
          <div class="tile__label">Pending &amp; offline 7d+</div>
          <div class="tile__value">{{ stats.totals.stale_pending }}</div>
        </div>
      </section>

      <section class="card">
        <header class="card__head">
          <h3>Pending by severity</h3>
        </header>
        <ul class="severity">
          <li v-for="(count, sev) in stats.severity_breakdown" :key="sev">
            <SeverityBadge :severity="String(sev)" />
            <span class="severity__count">{{ count }}</span>
          </li>
        </ul>
      </section>

      <section class="card">
        <header class="card__head">
          <h3>Top 10 pending KBs</h3>
          <span class="card__count">{{ stats.top_pending_kbs.length }}</span>
        </header>
        <div v-if="stats.top_pending_kbs.length === 0" class="card__empty">
          No pending updates across the fleet — nice.
        </div>
        <table v-else class="kb-table">
          <thead>
            <tr>
              <th>KB</th>
              <th>Title</th>
              <th>Severity</th>
              <th class="num">Agents</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in stats.top_pending_kbs" :key="r.kb">
              <td><a class="link" @click="onKbClick(r.kb)">{{ r.kb }}</a></td>
              <td class="title-cell" :title="r.title">{{ r.title || "(no title)" }}</td>
              <td><SeverityBadge :severity="r.severity" /></td>
              <td class="num">{{ r.agents_affected }}</td>
              <td class="actions">
                <q-btn
                  flat dense no-caps size="sm"
                  label="Approve all"
                  :loading="busyKb === r.kb && busyOp === 'approve'"
                  @click="onApproveAll(r.kb)"
                />
                <q-btn
                  flat dense no-caps size="sm"
                  label="Install on all"
                  color="primary"
                  :loading="busyKb === r.kb && busyOp === 'install'"
                  @click="onInstallAll(r.kb)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="stats.scan_failures.length" class="card">
        <header class="card__head">
          <h3>Agents with failed installs</h3>
          <span class="card__count">{{ stats.scan_failures.length }}</span>
        </header>
        <ul class="scan-list">
          <li v-for="row in stats.scan_failures" :key="row.agent_id">
            <RouterLink
              class="link"
              :to="{ name: 'DeviceDetail', params: { agent_id: row.agent_id }, query: { tab: 'patches' } }"
            >
              {{ row.hostname }}
            </RouterLink>
            <span class="scan-list__count">{{ row.failed_count }} failed</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { RouterLink } from "vue-router";
import {
  bulkKBAction,
  bulkKBInstall,
  fetchFleetStats,
  type FleetStats,
} from "@/api/patching";
import SeverityBadge from "./SeverityBadge.vue";

const $q = useQuasar();
const stats = ref<FleetStats | null>(null);
const loading = ref(false);
const errorMsg = ref("");
const busyKb = ref<string | null>(null);
const busyOp = ref<"approve" | "install" | null>(null);

const emit = defineEmits<{ (e: "open-kb", kb: string): void }>();

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    stats.value = await fetchFleetStats();
  } catch (err) {
    errorMsg.value = msg(err);
  } finally {
    loading.value = false;
  }
}

function onKbClick(kb: string) {
  emit("open-kb", kb);
}

async function onApproveAll(kb: string) {
  busyKb.value = kb;
  busyOp.value = "approve";
  try {
    const r = await bulkKBAction(kb, "approve");
    $q.notify({
      type: "positive",
      message: `${kb} approved on ${r.affected_agents} agents.`,
      position: "top",
      timeout: 2500,
    });
    await load();
  } catch (err) {
    $q.notify({ type: "negative", message: `Failed: ${msg(err)}`, position: "top" });
  } finally {
    busyKb.value = null;
    busyOp.value = null;
  }
}

async function onInstallAll(kb: string) {
  busyKb.value = kb;
  busyOp.value = "install";
  try {
    const r = await bulkKBInstall(kb);
    $q.notify({
      type: "positive",
      message: `${kb} install dispatched to ${r.dispatched_agents} agents.`,
      position: "top",
      timeout: 3000,
    });
    await load();
  } catch (err) {
    $q.notify({ type: "negative", message: `Failed: ${msg(err)}`, position: "top" });
  } finally {
    busyKb.value = null;
    busyOp.value = null;
  }
}

function msg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

defineExpose({ reload: load });
onMounted(load);
</script>

<style lang="scss" scoped>
.pov {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__bar {
    display: flex;
    justify-content: flex-end;
  }
  &__state {
    color: var(--color-fg-secondary);
    padding: 32px;
    text-align: center;
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.tile {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 14px 16px;
  &__label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-fg-secondary);
    font-weight: 600;
  }
  &__value {
    font-size: 28px;
    font-weight: 600;
    color: var(--color-fg-primary);
    margin-top: 4px;
  }
  &--ok    { border-left: 3px solid var(--color-state-positive-fg, #117a3a); }
  &--warn  { border-left: 3px solid var(--color-state-warning-fg, #8a5a00); }
  &--neg   { border-left: 3px solid var(--color-state-negative-fg, #a40e26); }
}

.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 14px 16px;

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-fg-secondary);
    }
  }
  &__count {
    background: var(--color-bg-page);
    border: 1px solid var(--color-border-subtle);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    color: var(--color-fg-secondary);
  }
  &__empty { color: var(--color-fg-secondary); font-size: 13px; padding: 8px 0; }
}

.severity {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  &__count { color: var(--color-fg-primary); font-weight: 600; }
}

.kb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-secondary);
    font-weight: 600;
  }
  .num { text-align: right; width: 80px; }
  .actions { text-align: right; width: 220px; white-space: nowrap; }
  .title-cell {
    max-width: 380px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.scan-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  li { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  &__count { color: var(--color-fg-secondary); font-size: 12px; }
}

.link {
  color: var(--color-fg-link, #0078d4);
  cursor: pointer;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
</style>
