<!--
  OverviewTab — at-a-glance facts for one agent.

  Surfaces what the live `status` ref already gives us (no extra fetch
  needed for the at-a-glance view). Recent script runs come from the
  shared agent history endpoint, filtered to the script_run type and
  capped to 3 rows for the at-a-glance card.
-->
<template>
  <div class="ad-tab">
    <div class="ad-tab__row">
      <article class="card">
        <h3 class="card__title">At a glance</h3>
        <dl class="kv">
          <div><dt>Hostname</dt><dd>{{ status.hostname || "—" }}</dd></div>
          <div><dt>Operating system</dt><dd>{{ status.operatingSystem || "—" }}</dd></div>
          <div><dt>Platform</dt><dd>{{ status.plat || "—" }}</dd></div>
          <div><dt>Agent version</dt><dd>v{{ status.version || "—" }}</dd></div>
          <div><dt>Monitoring type</dt><dd>{{ status.monitoringType || "—" }}</dd></div>
          <div><dt>Logged-in user</dt><dd>{{ status.loggedInUser || "—" }}</dd></div>
          <div><dt>Public IP</dt><dd>{{ status.publicIp || "—" }}</dd></div>
          <div><dt>LAN IP</dt><dd>{{ status.localIps || "—" }}</dd></div>
          <div><dt>Last seen</dt><dd>{{ formatDate(status.lastSeen) }}</dd></div>
        </dl>
      </article>

      <article class="card">
        <h3 class="card__title">Health</h3>
        <ul class="health">
          <li :class="status.failingChecks > 0 ? 'health--bad' : 'health--ok'">
            <span class="health__dot" />
            <span class="health__label">Checks</span>
            <span class="health__value">
              {{ status.failingChecks }} failing,
              {{ status.checks.warning }} warning,
              {{ status.checks.passing }} passing
            </span>
          </li>
          <li :class="status.hasPatchesPending ? 'health--bad' : 'health--ok'">
            <span class="health__dot" />
            <span class="health__label">Patches</span>
            <span class="health__value">
              {{ status.hasPatchesPending ? "pending updates available" : "up to date" }}
            </span>
          </li>
          <li :class="status.needsReboot ? 'health--bad' : 'health--ok'">
            <span class="health__dot" />
            <span class="health__label">Reboot</span>
            <span class="health__value">
              {{ status.needsReboot ? "reboot required" : "no reboot pending" }}
            </span>
          </li>
          <li :class="status.pendingActionsCount > 0 ? 'health--warn' : 'health--ok'">
            <span class="health__dot" />
            <span class="health__label">Actions</span>
            <span class="health__value">{{ status.pendingActionsCount }} pending</span>
          </li>
          <li :class="status.maintenanceMode ? 'health--warn' : 'health--ok'">
            <span class="health__dot" />
            <span class="health__label">Maintenance</span>
            <span class="health__value">
              {{ status.maintenanceMode ? "ON — alerts suppressed" : "off" }}
            </span>
          </li>
        </ul>
      </article>
    </div>

    <article class="card">
      <h3 class="card__title">Recent script runs</h3>
      <div v-if="loadingHistory" class="card__loading">Loading…</div>
      <div v-else-if="historyError" class="card__error">
        Couldn't load history: {{ historyError }}
      </div>
      <div v-else-if="recentScriptRuns.length === 0" class="card__empty">
        No script runs recorded for this agent.
      </div>
      <ul v-else class="runs">
        <li v-for="row in recentScriptRuns" :key="row.id" class="runs__row">
          <div class="runs__name">{{ row.script_name || "(unknown script)" }}</div>
          <div class="runs__meta">
            {{ row.username || "system" }} · {{ formatDate(row.time) }}
          </div>
          <div class="runs__status">
            {{ resultLabel(row) }}
          </div>
        </li>
      </ul>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { fetchAgentHistory } from "@/api/agents";
import type { LiveAgentStatus } from "@/composables/useAgentLiveStatus";

interface AgentHistoryRow {
  id: number;
  type: string;
  time: string;
  username: string;
  command: string | null;
  results: string | null;
  script_name?: string | null;
  script_results?: { retcode?: number; stdout?: string; stderr?: string } | null;
}

const props = defineProps<{
  agentId: string;
  status: LiveAgentStatus;
}>();

const recentScriptRuns = ref<AgentHistoryRow[]>([]);
const loadingHistory = ref(true);
const historyError = ref<string>("");

async function loadHistory() {
  if (!props.agentId) return;
  loadingHistory.value = true;
  historyError.value = "";
  try {
    const data = (await fetchAgentHistory(props.agentId)) as AgentHistoryRow[] | undefined;
    const rows = Array.isArray(data) ? data : [];
    recentScriptRuns.value = rows
      .filter((r) => r.type === "script_run")
      .slice(0, 3);
  } catch (err) {
    historyError.value = extractMessage(err);
  } finally {
    loadingHistory.value = false;
  }
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function resultLabel(row: AgentHistoryRow): string {
  const code = row.script_results?.retcode;
  if (code === undefined || code === null) return "no result yet";
  return code === 0 ? "success" : `exit code ${code}`;
}

watch(() => props.agentId, loadHistory);
onMounted(loadHistory);
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px;

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  }
}

.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 16px 18px;

  &__title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-secondary);
  }

  &__loading,
  &__empty,
  &__error {
    color: var(--color-fg-secondary);
    font-size: 13px;
    padding: 8px 0;
  }
}

.kv {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(0, 2fr);
  gap: 6px 18px;
  font-size: 13px;

  div { display: contents; }
  dt { color: var(--color-fg-secondary); margin: 0; }
  dd { margin: 0; color: var(--color-fg-primary); word-break: break-word; }
}

.health {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;

  li {
    display: grid;
    grid-template-columns: 14px 130px 1fr;
    gap: 10px;
    align-items: center;
  }

  &__dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--color-state-positive-fg, #117a3a);
  }
  &__label { color: var(--color-fg-secondary); }
  &__value { color: var(--color-fg-primary); }

  &--warn .health__dot { background: var(--color-state-warning-fg, #8a5a00); }
  &--bad  .health__dot { background: var(--color-state-negative-fg, #a40e26); }
}

.runs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    padding: 8px 10px;
    background: var(--color-bg-page);
    border-radius: 6px;
  }

  &__name { font-weight: 500; }
  &__meta { color: var(--color-fg-secondary); font-size: 12px; }
  &__status { color: var(--color-fg-secondary); font-size: 12px; }
}
</style>
