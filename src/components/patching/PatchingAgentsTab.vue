<!--
  PatchingAgentsTab — per-agent patch summary across the fleet.
  Click row → routes to /devices/:agent_id?tab=patches.
-->
<template>
  <div class="pa">
    <header class="pa__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search by hostname, client, site…"
        class="pa__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat dense no-caps icon="hourglass_empty" :label="staleLabel">
        <q-list dense style="min-width: 200px">
          <q-item v-for="o in staleOpts" :key="o.value" clickable @click="setStale(o.value, o.label)">
            <q-item-section>{{ o.label }}</q-item-section>
            <q-item-section side><q-icon v-if="staleDays === o.value" name="check" /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown flat dense no-caps icon="bolt" :label="`Pending ≥ ${pendingMin}`">
        <q-list dense style="min-width: 160px">
          <q-item v-for="n in [0, 1, 5, 10, 25]" :key="n" clickable @click="pendingMin = n; load()">
            <q-item-section>{{ n }}</q-item-section>
            <q-item-section side><q-icon v-if="pendingMin === n" name="check" /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="load" />
    </header>

    <div v-if="loading && !rows.length" class="state">Loading agents…</div>
    <div v-else-if="errorMsg && !rows.length" class="state state--error">
      Couldn't load: {{ errorMsg }}
    </div>
    <div v-else-if="!filteredRows.length" class="state">
      No agents match the current filters.
    </div>

    <table v-else class="tbl">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Client</th>
          <th>Site</th>
          <th class="num">Pending</th>
          <th class="num">Critical</th>
          <th class="num">Important</th>
          <th class="num">Failed</th>
          <th>Last install</th>
          <th class="actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in filteredRows" :key="r.agent_id" class="tbl__row" @click="goAgent(r.agent_id)">
          <td><span class="link">{{ r.hostname }}</span></td>
          <td>{{ r.client || "—" }}</td>
          <td>{{ r.site || "—" }}</td>
          <td class="num">{{ r.pending }}</td>
          <td class="num"><span :class="{ flag: r.pending_critical > 0 }">{{ r.pending_critical }}</span></td>
          <td class="num">{{ r.pending_important }}</td>
          <td class="num"><span :class="{ flag: r.failed > 0 }">{{ r.failed }}</span></td>
          <td>{{ formatDate(r.last_install) }}</td>
          <td class="actions" @click.stop>
            <q-btn flat dense no-caps size="sm" icon="open_in_new" @click.stop="goAgent(r.agent_id)" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchFleetAgents, type FleetAgentRow } from "@/api/patching";

const router = useRouter();
const rows = ref<FleetAgentRow[]>([]);
const loading = ref(false);
const errorMsg = ref("");
const search = ref("");
const staleDays = ref(0);
const staleLabel = ref("Any scan age");
const pendingMin = ref(0);

const staleOpts = [
  { value: 0, label: "Any scan age" },
  { value: 7, label: "Stale 7d+" },
  { value: 30, label: "Stale 30d+" },
];

const props = defineProps<{ kbFilter?: string }>();

const filteredRows = computed(() => {
  if (!search.value) return rows.value;
  const q = search.value.toLowerCase();
  return rows.value.filter(
    (r) =>
      (r.hostname || "").toLowerCase().includes(q) ||
      (r.client || "").toLowerCase().includes(q) ||
      (r.site || "").toLowerCase().includes(q),
  );
});

function setStale(v: number, label: string) {
  staleDays.value = v;
  staleLabel.value = label;
  void load();
}

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    rows.value = await fetchFleetAgents({
      kb: props.kbFilter || undefined,
      pending_min: pendingMin.value || undefined,
      scan_stale_days: staleDays.value || undefined,
    });
  } catch (err) {
    errorMsg.value = msg(err);
  } finally {
    loading.value = false;
  }
}

function goAgent(id: string) {
  void router.push({
    name: "DeviceDetail",
    params: { agent_id: id },
    query: { tab: "patches" },
  });
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
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
.pa {
  display: flex;
  flex-direction: column;
  gap: 10px;
  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__search { min-width: 260px; max-width: 380px; flex: 0 1 380px; }
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
  .num { text-align: right; width: 80px; }
  .actions { width: 60px; text-align: right; }
  &__row { cursor: pointer; &:hover { background: var(--color-bg-page); } }
}

.flag {
  background: var(--color-state-negative-bg, #fde7e9);
  color: var(--color-state-negative-fg, #a40e26);
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}

.link {
  color: var(--color-fg-link, #0078d4);
  text-decoration: none;
}
</style>
