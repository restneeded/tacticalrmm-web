<!--
  PatchingHistoryTab — fleet-wide patch install history.
-->
<template>
  <div class="ph">
    <header class="ph__bar">
      <q-input v-model="kbFilter" dense outlined clearable
        placeholder="Filter by KB id…" class="ph__search" @update:model-value="onChange">
        <template #prepend><q-icon name="filter_list" /></template>
      </q-input>

      <q-btn-dropdown flat dense no-caps icon="event" :label="windowLabel">
        <q-list dense style="min-width: 200px">
          <q-item v-for="o in windowOpts" :key="o.value" clickable @click="setWindow(o.value, o.label)">
            <q-item-section>{{ o.label }}</q-item-section>
            <q-item-section side><q-icon v-if="sinceDays === o.value" name="check" /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="load" />
    </header>

    <div v-if="loading && !rows.length" class="state">Loading history…</div>
    <div v-else-if="errorMsg && !rows.length" class="state state--error">
      Couldn't load: {{ errorMsg }}
    </div>
    <div v-else-if="!rows.length" class="state">No install history in this window.</div>

    <table v-else class="tbl">
      <thead>
        <tr>
          <th>When</th>
          <th>Agent</th>
          <th>KB</th>
          <th>Title</th>
          <th>Severity</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td>{{ formatDate(r.date_installed) }}</td>
          <td>
            <RouterLink class="link"
              :to="{ name: 'DeviceDetail', params: { agent_id: r.agent_id }, query: { tab: 'patches' } }">
              {{ r.hostname }}
            </RouterLink>
          </td>
          <td>{{ r.kb || "—" }}</td>
          <td class="title-cell" :title="r.title || ''">{{ r.title || "(no title)" }}</td>
          <td><SeverityBadge :severity="r.severity" /></td>
          <td>
            <span :class="resultClass(r.result)">{{ r.result || "—" }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchFleetHistory, type FleetHistoryRow } from "@/api/patching";
import SeverityBadge from "./SeverityBadge.vue";

const rows = ref<FleetHistoryRow[]>([]);
const loading = ref(false);
const errorMsg = ref("");
const kbFilter = ref("");
const sinceDays = ref(30);
const windowLabel = ref("Last 30 days");

const windowOpts = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last year" },
  { value: 0, label: "All time" },
];

let searchT: ReturnType<typeof setTimeout> | undefined;
function onChange() {
  clearTimeout(searchT);
  searchT = setTimeout(load, 250);
}
function setWindow(v: number, label: string) {
  sinceDays.value = v;
  windowLabel.value = label;
  void load();
}

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await fetchFleetHistory({
      kb: kbFilter.value || undefined,
      since_days: sinceDays.value || undefined,
    });
  } catch (err) {
    errorMsg.value = msg(err);
  } finally {
    loading.value = false;
  }
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function resultClass(r: string) {
  const v = (r || "").toLowerCase();
  if (v === "success") return "ok";
  if (!v || v === "n/a") return "neutral";
  return "bad";
}

function msg(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

defineExpose({ reload: load });
onMounted(load);
</script>

<style lang="scss" scoped>
.ph {
  display: flex;
  flex-direction: column;
  gap: 10px;
  &__bar { display: flex; align-items: center; gap: 8px; }
  &__search { min-width: 220px; max-width: 320px; flex: 0 1 320px; }
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
  .title-cell {
    max-width: 380px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.link { color: var(--color-fg-link, #0078d4); text-decoration: none; }
.ok { color: var(--color-state-positive-fg, #117a3a); font-weight: 600; }
.bad { color: var(--color-state-negative-fg, #a40e26); font-weight: 600; }
.neutral { color: var(--color-fg-secondary); }
</style>
