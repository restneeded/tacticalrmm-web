<!--
  DiagnosticsTab — Phase R per-agent ops surface inside Agent Detail.

  Three blocks: action buttons (recover/ping/processes/event log), recent
  audit entries scoped to this agent (with deep-link to /audit), and
  pending actions for this agent (with deep-link to /pending).
-->
<template>
  <div class="agdiag">
    <!-- Actions -->
    <section class="agdiag__section">
      <header class="agdiag__head">
        <h3 class="agdiag__title">Actions</h3>
        <p class="agdiag__sub">Send a recovery / probe / live-state command to this agent.</p>
      </header>

      <div class="agdiag__actions">
        <q-btn
          unelevated no-caps icon="restart_alt" color="primary"
          label="Recover agent service"
          :loading="busy.recoverAgent"
          @click="run('recoverAgent')"
        />
        <q-btn
          flat no-caps icon="sync" color="primary"
          label="Recover Mesh"
          :loading="busy.recoverMesh"
          @click="run('recoverMesh')"
        />
        <q-btn
          flat no-caps icon="network_ping" color="primary"
          label="NATS ping"
          :loading="busy.ping"
          @click="run('ping')"
        />
        <q-btn
          flat no-caps icon="memory" color="primary"
          label="Process list"
          :loading="busy.processes"
          @click="run('processes')"
        />
      </div>

      <div v-if="lastResult" class="agdiag__result">
        <span class="agdiag__result-pill" :data-kind="lastResult.kind">
          {{ lastResult.label }}
        </span>
        <pre v-if="lastResult.body" class="agdiag__json">{{ lastResult.body }}</pre>
      </div>
    </section>

    <!-- Recent audit -->
    <section class="agdiag__section">
      <header class="agdiag__head">
        <h3 class="agdiag__title">Recent audit (this agent)</h3>
        <router-link
          :to="`/audit?agent=${encodeURIComponent(agentId)}`"
          class="agdiag__link"
        >Open in /audit →</router-link>
      </header>

      <div v-if="auditLoading" class="agdiag__placeholder">Loading…</div>
      <div v-else-if="audit.length === 0" class="agdiag__placeholder">
        No audit entries for this agent in the last 30 days.
      </div>
      <ul v-else class="agdiag__list">
        <li v-for="r in audit" :key="r.id">
          <span class="agdiag__list-when">{{ relativeTime(r.entry_time) }}</span>
          <span class="agdiag__list-user">{{ r.username }}</span>
          <span class="agdiag__list-action">{{ r.action }}</span>
          <span class="agdiag__list-msg">{{ r.message }}</span>
        </li>
      </ul>
    </section>

    <!-- Pending -->
    <section class="agdiag__section">
      <header class="agdiag__head">
        <h3 class="agdiag__title">Pending actions (this agent)</h3>
        <router-link to="/pending" class="agdiag__link">Open /pending →</router-link>
      </header>

      <div v-if="pendingLoading" class="agdiag__placeholder">Loading…</div>
      <div v-else-if="pending.length === 0" class="agdiag__placeholder">
        Nothing queued for this agent.
      </div>
      <ul v-else class="agdiag__list">
        <li v-for="r in pending" :key="r.id">
          <span class="agdiag__list-when">{{ relativeTime(r.entry_time) }}</span>
          <span
            class="agdiag__list-status"
            :data-kind="r.status"
          >{{ r.status }}</span>
          <span class="agdiag__list-action">{{ formatActionType(r.action_type) }}</span>
          <span class="agdiag__list-msg">{{ r.description }}</span>
          <q-btn
            v-if="r.status === 'pending'"
            flat dense round size="sm" icon="close" color="negative"
            @click="onCancel(r.id)"
            aria-label="Cancel"
          >
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useQuasar } from "quasar";

import { fetchAuditLogs, type AuditLogRow } from "@/api/audit";
import {
  cancelPendingAction,
  fetchAgentPendingActions,
  formatActionType,
  type PendingActionRow,
} from "@/api/pending";
import {
  fetchAgentProcesses,
  pingAgent,
  recoverAgent,
} from "@/api/diagnostics";

const props = defineProps<{ agentId: string }>();
const $q = useQuasar();

const busy = reactive({
  recoverAgent: false,
  recoverMesh:  false,
  ping:         false,
  processes:    false,
});
const lastResult = ref<{ kind: "ok" | "warn" | "neg"; label: string; body?: string } | null>(null);

async function run(action: keyof typeof busy) {
  busy[action] = true;
  try {
    if (action === "recoverAgent") {
      await recoverAgent(props.agentId, "tacagent");
      lastResult.value = { kind: "ok", label: "Recovery dispatched (agent service)." };
      $q.notify({ type: "positive", message: "Recovery dispatched." });
    } else if (action === "recoverMesh") {
      await recoverAgent(props.agentId, "mesh");
      lastResult.value = { kind: "ok", label: "Recovery dispatched (mesh)." };
      $q.notify({ type: "positive", message: "Mesh recovery dispatched." });
    } else if (action === "ping") {
      const r = await pingAgent(props.agentId);
      lastResult.value = { kind: r.status === "online" ? "ok" : "warn", label: `Ping: ${r.status}` };
    } else if (action === "processes") {
      const r = await fetchAgentProcesses(props.agentId);
      lastResult.value = {
        kind: "ok",
        label: `${r.length} processes`,
        body: r.slice(0, 12).map(p => `${p.pid.toString().padStart(6, " ")}  ${p.name}`).join("\n") + (r.length > 12 ? `\n… +${r.length - 12} more` : ""),
      };
    }
  } catch (e) {
    const err = e as { response?: { data?: { toString?: () => string } } };
    lastResult.value = { kind: "neg", label: err?.response?.data?.toString?.() || "Request failed." };
    $q.notify({ type: "negative", message: lastResult.value.label });
  } finally {
    busy[action] = false;
    if (action === "recoverAgent" || action === "recoverMesh") {
      void loadPending();
    }
  }
}

// --- Audit (scoped) ---
const audit = ref<AuditLogRow[]>([]);
const auditLoading = ref(true);

async function loadAudit() {
  auditLoading.value = true;
  try {
    const r = await fetchAuditLogs({
      pagination: { sortBy: "entry_time", descending: true, page: 1, rowsPerPage: 50 },
      agentFilter: [props.agentId],
      timeFilter: 30,
    });
    audit.value = r.audit_logs;
  } catch {
    audit.value = [];
  } finally {
    auditLoading.value = false;
  }
}

// --- Pending (scoped) ---
const pending = ref<PendingActionRow[]>([]);
const pendingLoading = ref(true);

async function loadPending() {
  pendingLoading.value = true;
  try {
    pending.value = (await fetchAgentPendingActions(props.agentId)).slice(0, 20);
  } catch {
    pending.value = [];
  } finally {
    pendingLoading.value = false;
  }
}

async function onCancel(pk: number) {
  try {
    await cancelPendingAction(pk);
    $q.notify({ type: "positive", message: "Cancelled." });
    await loadPending();
  } catch {
    $q.notify({ type: "negative", message: "Could not cancel." });
  }
}

function relativeTime(t: string): string {
  if (!t) return "";
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)         return `${Math.round(diff)}s ago`;
  if (diff < 3600)       return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7)  return `${Math.round(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

onMounted(() => {
  void loadAudit();
  void loadPending();
});
</script>

<style lang="scss" scoped>
.agdiag {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 4px;

  &__section {
    background: var(--color-bg-surface-1);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 16px 18px;
  }
  &__head {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 12px; margin-bottom: 10px;
  }
  &__title {
    margin: 0; font-size: var(--intune-font-size-400);
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-primary);
  }
  &__sub {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    margin: 0;
  }
  &__link {
    color: var(--color-fg-link, #2667c6);
    text-decoration: none;
    font-size: var(--intune-font-size-200);
    &:hover { text-decoration: underline; }
  }
  &__actions {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  &__result {
    margin-top: 12px;
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 10px 12px;
  }
  &__result-pill {
    display: inline-block;
    padding: 1px 8px;
    border-radius: var(--intune-radius-circular);
    font-size: var(--intune-font-size-200);
    border: 1px solid var(--color-stroke-divider);
    background: var(--color-bg-surface-2);
    color: var(--color-fg-secondary);
    &[data-kind="ok"]   { background: rgba( 16,160, 96, 0.14); color: #1c7a4d; border-color: rgba(16,160, 96, 0.4); }
    &[data-kind="warn"] { background: rgba(255,170, 68, 0.16); color: #b56b00; border-color: rgba(255,170, 68, 0.4); }
    &[data-kind="neg"]  { background: rgba(232, 68, 86, 0.14); color: #b32d3d; border-color: rgba(232, 68, 86, 0.4); }
  }
  &__json {
    margin: 8px 0 0 0;
    font-size: var(--intune-font-size-200);
    font-family: var(--intune-font-mono, monospace);
    white-space: pre-wrap;
    color: var(--color-fg-primary);
    max-height: 240px; overflow: auto;
  }
  &__placeholder {
    color: var(--color-fg-tertiary);
    padding: 8px 0;
    font-size: var(--intune-font-size-300);
  }
  &__list {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column;
    li {
      display: flex; gap: 12px; align-items: center;
      padding: 6px 0;
      border-bottom: 1px dashed var(--color-stroke-divider);
      font-size: var(--intune-font-size-300);
      &:last-child { border-bottom: none; }
    }
  }
  &__list-when    { color: var(--color-fg-tertiary); min-width: 80px; }
  &__list-user    { color: var(--color-fg-primary); min-width: 120px; }
  &__list-action  { color: var(--color-fg-secondary); min-width: 130px; text-transform: capitalize; }
  &__list-msg     { color: var(--color-fg-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__list-status {
    display: inline-block;
    padding: 1px 8px;
    border-radius: var(--intune-radius-circular);
    font-size: var(--intune-font-size-200);
    border: 1px solid var(--color-stroke-divider);
    background: var(--color-bg-surface-2);
    color: var(--color-fg-secondary);
    text-transform: capitalize;
    min-width: 88px; text-align: center;
    &[data-kind="pending"]   { background: rgba( 32,128,232, 0.12); color: #1f5fbb; border-color: rgba(32,128,232, 0.4); }
    &[data-kind="completed"] { background: rgba( 16,160, 96, 0.14); color: #1c7a4d; border-color: rgba(16,160, 96, 0.4); }
  }
}
</style>
