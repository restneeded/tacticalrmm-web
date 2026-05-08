<!--
  PatchingKBsTab — KB-aggregated table across the fleet.
  Click a row → emit("open-kb", kb).
-->
<template>
  <div class="pkbs">
    <header class="pkbs__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search by KB id or title…"
        class="pkbs__search"
        @update:model-value="onChange"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat dense no-caps icon="filter_list" :label="severityLabel">
        <q-list dense style="min-width: 200px">
          <q-item clickable @click="setSeverity('')">
            <q-item-section>All severities</q-item-section>
            <q-item-section side><q-icon v-if="!severity" name="check" /></q-item-section>
          </q-item>
          <q-item v-for="s in severities" :key="s" clickable @click="setSeverity(s)">
            <q-item-section>{{ s }}</q-item-section>
            <q-item-section side><q-icon v-if="severity === s" name="check" /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown flat dense no-caps icon="rule" :label="statusLabel">
        <q-list dense style="min-width: 200px">
          <q-item v-for="o in statusOpts" :key="o.value" clickable @click="setStatus(o.value)">
            <q-item-section>{{ o.label }}</q-item-section>
            <q-item-section side><q-icon v-if="status === o.value" name="check" /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="load" />
    </header>

    <div v-if="loading && !rows.length" class="state">Loading KBs…</div>
    <div v-else-if="errorMsg && !rows.length" class="state state--error">
      Couldn't load KBs: {{ errorMsg }}
    </div>
    <div v-else-if="!rows.length" class="state">
      No KBs match the current filters.
    </div>

    <table v-else class="tbl">
      <thead>
        <tr>
          <th>KB</th>
          <th>Title</th>
          <th>Severity</th>
          <th class="num">Pending</th>
          <th class="num">Approved</th>
          <th class="num">Installed</th>
          <th class="num">Ignored</th>
          <th class="actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.kb" class="tbl__row" @click="onClick(r)">
          <td><span class="link">{{ r.kb }}</span></td>
          <td class="title-cell" :title="r.title || ''">{{ r.title || "(no title)" }}</td>
          <td><SeverityBadge :severity="r.severity" /></td>
          <td class="num">{{ r.agents_pending }}</td>
          <td class="num">{{ r.agents_approved }}</td>
          <td class="num">{{ r.agents_installed }}</td>
          <td class="num">{{ r.agents_ignored }}</td>
          <td class="actions" @click.stop>
            <q-btn flat dense no-caps size="sm" label="Approve all"
              :loading="busy.kb === r.kb && busy.op === 'approve'"
              @click.stop="onAction(r.kb, 'approve')" />
            <q-btn flat dense no-caps size="sm" label="Ignore"
              :loading="busy.kb === r.kb && busy.op === 'ignore'"
              @click.stop="onAction(r.kb, 'ignore')" />
            <q-btn flat dense no-caps size="sm" label="Install on all"
              color="primary"
              :loading="busy.kb === r.kb && busy.op === 'install'"
              @click.stop="onInstall(r.kb)" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useQuasar } from "quasar";
import {
  bulkKBAction,
  bulkKBInstall,
  fetchFleetKBs,
  type FleetKBRow,
} from "@/api/patching";
import SeverityBadge from "./SeverityBadge.vue";

const $q = useQuasar();
const rows = ref<FleetKBRow[]>([]);
const loading = ref(false);
const errorMsg = ref("");
const search = ref("");
const severity = ref("");
const status = ref("pending");

const severities = ["Critical", "Important", "Moderate", "Low", "Optional"];
const statusOpts = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "ignored", label: "Ignored" },
  { value: "installed", label: "Installed" },
];

const severityLabel = ref("Severity");
const statusLabel = ref("Pending");

const busy = reactive<{ kb: string | null; op: string | null }>({
  kb: null,
  op: null,
});

const emit = defineEmits<{ (e: "open-kb", kb: string): void }>();

let searchT: ReturnType<typeof setTimeout> | undefined;
function onChange() {
  clearTimeout(searchT);
  searchT = setTimeout(load, 250);
}
function setSeverity(v: string) {
  severity.value = v;
  severityLabel.value = v || "Severity";
  void load();
}
function setStatus(v: string) {
  status.value = v;
  const found = statusOpts.find((o) => o.value === v);
  statusLabel.value = found ? found.label : "Status";
  void load();
}

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await fetchFleetKBs({
      search: search.value || undefined,
      severity: severity.value || undefined,
      status: status.value,
    });
  } catch (err) {
    errorMsg.value = msg(err);
  } finally {
    loading.value = false;
  }
}

function onClick(r: FleetKBRow) {
  emit("open-kb", r.kb);
}

async function onAction(kb: string, action: "approve" | "ignore") {
  busy.kb = kb;
  busy.op = action;
  try {
    const r = await bulkKBAction(kb, action);
    $q.notify({
      type: "positive",
      message: `${kb} → ${action} on ${r.affected_agents} agents.`,
      position: "top",
      timeout: 2500,
    });
    await load();
  } catch (err) {
    $q.notify({ type: "negative", message: msg(err), position: "top" });
  } finally {
    busy.kb = null;
    busy.op = null;
  }
}

async function onInstall(kb: string) {
  busy.kb = kb;
  busy.op = "install";
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
    $q.notify({ type: "negative", message: msg(err), position: "top" });
  } finally {
    busy.kb = null;
    busy.op = null;
  }
}

function msg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

watch(() => statusLabel.value, () => {});
defineExpose({ reload: load });
onMounted(load);
</script>

<style lang="scss" scoped>
.pkbs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__search { min-width: 280px; max-width: 380px; flex: 0 1 380px; }
}

.state {
  color: var(--color-fg-secondary);
  padding: 32px;
  text-align: center;
  &--error { color: var(--color-state-negative-fg, #a40e26); }
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  overflow: hidden;

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-secondary);
    font-weight: 600;
    background: var(--color-bg-page);
  }
  .num { text-align: right; width: 90px; }
  .actions { text-align: right; width: 320px; white-space: nowrap; }
  .title-cell {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__row {
    cursor: pointer;
    &:hover { background: var(--color-bg-page); }
  }
}

.link {
  color: var(--color-fg-link, #0078d4);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}
</style>
