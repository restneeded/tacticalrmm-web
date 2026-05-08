<!--
  PatchesTab — Windows Update state for one agent.

  Endpoints used (existing winupdate app):
    GET  /winupdate/<id>/         → list of WinUpdate rows for the agent
    POST /winupdate/<id>/scan/    → triggers a scan task
    POST /winupdate/<id>/install/ → triggers install-all task

  Splits the rows into Pending vs Installed. Severity, KB, requires-
  reboot are surfaced. The policies side stays intentionally untouched —
  Phase Q rebuilds the per-policy approvals workflow.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-btn
        flat
        dense
        no-caps
        icon="search"
        label="Scan now"
        :loading="scanning"
        @click="onScan"
      />
      <q-btn
        flat
        dense
        no-caps
        icon="download"
        label="Install all"
        :loading="installing"
        :disable="pendingRows.length === 0"
        @click="onInstallAll"
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        :loading="loading"
        @click="load"
      />
    </header>

    <div v-if="loading && rows.length === 0" class="state">Loading patch state…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="state state--error">
      Couldn't load patches: {{ errorMsg }}
    </div>

    <section class="card">
      <header class="card__head">
        <h3>Pending</h3>
        <span class="card__count">{{ pendingRows.length }}</span>
      </header>
      <div v-if="pendingRows.length === 0" class="card__empty">
        No pending Windows updates.
      </div>
      <ul v-else class="patch-list">
        <li v-for="r in pendingRows" :key="r.id" class="patch">
          <div class="patch__head">
            <span class="patch__title" :title="r.title || ''">{{ r.title || "(no title)" }}</span>
            <span v-if="r.severity" class="badge" :class="`badge--${severityTone(r.severity)}`">
              {{ r.severity }}
            </span>
          </div>
          <div class="patch__meta">
            <span v-if="r.kb">{{ r.kb }}</span>
            <span v-if="r.downloaded">downloaded</span>
            <span v-if="r.action && r.action !== 'nothing'">action: {{ r.action }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="card">
      <header class="card__head">
        <h3>Recently installed</h3>
        <span class="card__count">{{ installedRows.length }}</span>
      </header>
      <div v-if="installedRows.length === 0" class="card__empty">
        No installation history yet.
      </div>
      <ul v-else class="patch-list">
        <li v-for="r in installedRows.slice(0, 50)" :key="r.id" class="patch patch--ok">
          <div class="patch__head">
            <span class="patch__title" :title="r.title || ''">{{ r.title || "(no title)" }}</span>
            <span class="patch__when">{{ r.date_installed || "" }}</span>
          </div>
          <div class="patch__meta">
            <span v-if="r.kb">{{ r.kb }}</span>
            <span v-if="r.result">{{ r.result }}</span>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import {
  fetchAgentUpdates,
  runAgentUpdateScan,
  runAgentUpdateInstall,
} from "@/api/winupdates";

interface WinUpdateRow {
  id: number;
  kb: string | null;
  guid: string | null;
  title: string | null;
  installed: boolean;
  downloaded: boolean;
  description: string | null;
  severity: string | null;
  date_installed: string | null;
  action: string;
  result: string;
}

const props = defineProps<{ agentId: string }>();
const $q = useQuasar();

const rows = ref<WinUpdateRow[]>([]);
const loading = ref(true);
const errorMsg = ref("");
const scanning = ref(false);
const installing = ref(false);

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = (await fetchAgentUpdates(props.agentId)) as WinUpdateRow[] | undefined;
    rows.value = Array.isArray(data) ? data : [];
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const pendingRows = computed(() =>
  rows.value
    .filter((r) => !r.installed)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
);
const installedRows = computed(() =>
  rows.value
    .filter((r) => r.installed)
    .sort((a, b) => (b.date_installed || "").localeCompare(a.date_installed || "")),
);

async function onScan() {
  scanning.value = true;
  try {
    await runAgentUpdateScan(props.agentId);
    $q.notify({
      type: "positive",
      message: "Patch scan queued for next agent check-in.",
      position: "top",
      timeout: 3000,
    });
  } catch (err) {
    $q.notify({
      type: "negative",
      message: `Couldn't queue scan: ${extractMessage(err)}`,
      position: "top",
      timeout: 3000,
    });
  } finally {
    scanning.value = false;
  }
}

async function onInstallAll() {
  installing.value = true;
  try {
    await runAgentUpdateInstall(props.agentId);
    $q.notify({
      type: "positive",
      message: "Install-all queued. The agent will run updates on its next check-in.",
      position: "top",
      timeout: 3500,
    });
  } catch (err) {
    $q.notify({
      type: "negative",
      message: `Couldn't queue install: ${extractMessage(err)}`,
      position: "top",
      timeout: 3500,
    });
  } finally {
    installing.value = false;
  }
}

function severityRank(sev: string | null): number {
  switch ((sev || "").toLowerCase()) {
    case "critical": return 4;
    case "important": return 3;
    case "moderate": return 2;
    case "low": return 1;
    default: return 0;
  }
}
function severityTone(sev: string | null): "neg" | "warn" | "neutral" {
  const r = severityRank(sev);
  if (r >= 3) return "neg";
  if (r >= 1) return "warn";
  return "neutral";
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

watch(() => props.agentId, load);
onMounted(load);
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;
  &--error { color: var(--color-state-negative-fg, #a40e26); }
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
  &__empty { color: var(--color-fg-secondary); font-size: 13px; padding: 4px 0; }
}

.patch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.patch {
  background: var(--color-bg-page);
  border-left: 3px solid var(--color-fg-secondary);
  border-radius: 6px;
  padding: 8px 12px;

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  &__title {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__when {
    font-size: 11px;
    color: var(--color-fg-secondary);
  }
  &__meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--color-fg-secondary);
    margin-top: 2px;
  }

  &--ok {
    border-left-color: var(--color-state-positive-fg, #117a3a);
  }
}

.badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 8px;
  letter-spacing: 0.04em;

  &--neg {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
  }
  &--warn {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
  }
  &--neutral {
    background: var(--color-bg-page);
    color: var(--color-fg-secondary);
  }
}
</style>
