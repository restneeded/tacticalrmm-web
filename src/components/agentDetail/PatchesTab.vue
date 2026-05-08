<!--
  PatchesTab — Windows Update state for one agent.

  Endpoints used (existing winupdate app):
    GET  /winupdate/<id>/         → list of WinUpdate rows for the agent
    POST /winupdate/<id>/scan/    → triggers a scan task
    POST /winupdate/<id>/install/ → triggers install-all task
    PUT  /winupdate/<update_id>/  → change action of a single update

  Phase Q upgrade: per-KB action picker, bulk approve / ignore for the
  agent's pending KBs, link out to the agent's policy editor.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-btn flat dense no-caps icon="search" label="Scan now"
        :loading="scanning" @click="onScan" />
      <q-btn flat dense no-caps icon="download" label="Install approved"
        :loading="installing" :disable="approvedRows.length === 0"
        @click="onInstallApproved" />

      <q-btn-dropdown
        v-if="pendingRows.length"
        flat dense no-caps icon="checklist"
        :label="`Bulk (${pendingRows.length} pending)`"
      >
        <q-list dense>
          <q-item clickable @click="bulkSet('approve')">
            <q-item-section>Approve all pending</q-item-section>
          </q-item>
          <q-item clickable @click="bulkSet('ignore')">
            <q-item-section>Ignore all pending</q-item-section>
          </q-item>
          <q-item clickable @click="bulkSet('nothing')">
            <q-item-section>Reset to default</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />

      <q-btn flat dense no-caps icon="refresh" :loading="loading" @click="load" />
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
            <span class="patch__action">
              <select
                class="patch__select"
                :value="r.action"
                :disabled="busyIds.has(r.id)"
                @change="onActionChange(r, $event)"
              >
                <option value="nothing">Default</option>
                <option value="approve">Approve</option>
                <option value="ignore">Ignore</option>
                <option value="inherit">Inherit</option>
              </select>
              <q-spinner v-if="busyIds.has(r.id)" size="14px" />
            </span>
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

    <footer class="ad-tab__footer">
      <RouterLink class="link" :to="{ name: 'Patching' }">
        Manage fleet patches →
      </RouterLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from "vue";
import { useQuasar } from "quasar";
import { RouterLink } from "vue-router";
import {
  fetchAgentUpdates,
  runAgentUpdateScan,
  runAgentUpdateInstall,
  editAgentUpdate,
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
const busyIds = reactive(new Set<number>());

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
const approvedRows = computed(() =>
  pendingRows.value.filter((r) => r.action === "approve"),
);

async function onActionChange(row: WinUpdateRow, ev: Event) {
  const target = ev.target as HTMLSelectElement;
  const next = target.value;
  busyIds.add(row.id);
  try {
    await editAgentUpdate(row.id, { action: next });
    row.action = next;
    $q.notify({
      type: "positive",
      message: `${row.kb || row.title || "Update"} → ${next}`,
      position: "top",
      timeout: 1500,
    });
  } catch (err) {
    target.value = row.action;
    $q.notify({
      type: "negative",
      message: `Couldn't update: ${extractMessage(err)}`,
      position: "top",
      timeout: 2500,
    });
  } finally {
    busyIds.delete(row.id);
  }
}

async function bulkSet(action: "approve" | "ignore" | "nothing") {
  const targets = pendingRows.value.slice();
  if (!targets.length) return;
  $q.notify({
    type: "ongoing",
    message: `Updating ${targets.length} updates…`,
    position: "top",
    timeout: 1200,
  });
  await Promise.all(
    targets.map(async (r) => {
      busyIds.add(r.id);
      try {
        await editAgentUpdate(r.id, { action });
        r.action = action;
      } catch {
        /* swallow per-row failures, summarized below */
      } finally {
        busyIds.delete(r.id);
      }
    }),
  );
  $q.notify({
    type: "positive",
    message: `Bulk ${action} applied.`,
    position: "top",
    timeout: 2000,
  });
}

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

async function onInstallApproved() {
  installing.value = true;
  try {
    await runAgentUpdateInstall(props.agentId);
    $q.notify({
      type: "positive",
      message: "Install queued. The agent will run approved updates on its next check-in.",
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
  &__footer {
    margin-top: 8px;
    text-align: right;
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
    align-items: center;
  }
  &__action {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  &__select {
    background: var(--color-bg-surface);
    color: var(--color-fg-primary);
    border: 1px solid var(--color-border-subtle);
    border-radius: 4px;
    font-size: 11px;
    padding: 2px 6px;
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

.link {
  color: var(--color-fg-link, #0078d4);
  text-decoration: none;
  font-size: 13px;
  &:hover { text-decoration: underline; }
}
</style>
