<!--
  HardwareTab — full hardware specs from the agent's last poll.

  Most fields come from the live status (cpu_model, total_ram, disks,
  public_ip, local_ips, make_model, graphics, physical_disks). Serial
  number lives in wmi_detail which we don't carry on the live shape;
  rather than enriching the composable for one tab, we fetch the
  full agent object once on mount.

  "Refresh hardware" → POST /agents/<id>/wmi/ which queues a re-poll
  task on the agent (it doesn't return new data inline; we then call
  the live composable's refresh() so the user can see the next poll
  as soon as the agent reports back).
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        :label="repolling ? 'Re-polling…' : 'Refresh hardware'"
        :loading="repolling"
        @click="onRepoll"
      />
    </header>

    <div class="ad-tab__row">
      <article class="card">
        <h3 class="card__title">System</h3>
        <dl class="kv">
          <div><dt>Make / model</dt><dd>{{ status.makeModel || "—" }}</dd></div>
          <div><dt>Serial number</dt><dd>{{ serialNumber || "—" }}</dd></div>
          <div><dt>BIOS</dt><dd>{{ biosLabel || "—" }}</dd></div>
          <div><dt>Motherboard</dt><dd>{{ motherboardLabel || "—" }}</dd></div>
          <div><dt>Graphics</dt><dd>{{ agentExtras?.graphics || "—" }}</dd></div>
        </dl>
      </article>

      <article class="card">
        <h3 class="card__title">Compute</h3>
        <dl class="kv">
          <div>
            <dt>CPU</dt>
            <dd>
              <div v-if="cpuRows.length === 0">—</div>
              <div v-for="(c, i) in cpuRows" :key="i">{{ c }}</div>
            </dd>
          </div>
          <div><dt>Cores (logical)</dt><dd>{{ cpuLogical || "—" }}</dd></div>
          <div><dt>RAM</dt><dd>{{ status.totalRamGb !== null ? `${status.totalRamGb} GB` : "—" }}</dd></div>
        </dl>
      </article>
    </div>

    <article class="card">
      <h3 class="card__title">Disks</h3>
      <div v-if="status.disks.length === 0" class="card__empty">
        No disks reported.
      </div>
      <ul v-else class="disks">
        <li v-for="d in status.disks" :key="d.device" class="disks__row">
          <div class="disks__head">
            <span class="disks__device">{{ d.device }}</span>
            <span class="disks__fs">{{ d.fstype }}</span>
            <span class="disks__pct">{{ d.percent }}% used</span>
          </div>
          <div class="disks__bar">
            <div
              class="disks__fill"
              :class="diskClass(d.percent)"
              :style="{ width: `${Math.max(0, Math.min(100, d.percent))}%` }"
            />
          </div>
          <div class="disks__sub">{{ d.free }} free of {{ d.total }}</div>
        </li>
      </ul>
    </article>

    <article class="card">
      <h3 class="card__title">Physical disks</h3>
      <ul v-if="(agentExtras?.physical_disks ?? []).length" class="plain">
        <li v-for="(p, i) in agentExtras.physical_disks" :key="i">{{ p }}</li>
      </ul>
      <div v-else class="card__empty">No physical-disk inventory reported.</div>
    </article>

    <article class="card">
      <h3 class="card__title">Network</h3>
      <dl class="kv">
        <div><dt>Public IP</dt><dd>{{ status.publicIp || "—" }}</dd></div>
        <div><dt>LAN IPs</dt><dd>{{ status.localIps || "—" }}</dd></div>
      </dl>
      <div v-if="nics.length" class="net">
        <h4 class="net__title">Interfaces</h4>
        <table class="net__table">
          <thead>
            <tr>
              <th>Adapter</th>
              <th>IPv4</th>
              <th>MAC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(n, i) in nics" :key="i">
              <td>{{ n.name }}</td>
              <td>{{ n.ipv4 || "—" }}</td>
              <td>{{ n.mac || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Notify } from "quasar";
import { fetchAgent, refreshAgentWMI } from "@/api/agents";
import type { LiveAgentStatus } from "@/composables/useAgentLiveStatus";

interface AgentExtras {
  cpu_model?: string[];
  graphics?: string;
  physical_disks?: string[];
  wmi_detail?: Record<string, unknown>;
  interfaces?: Array<{
    name?: string;
    ipv4?: string;
    mac?: string;
    addresses?: Array<{ family?: string; address?: string }>;
  }>;
}

const props = defineProps<{
  agentId: string;
  status: LiveAgentStatus;
  refresh: () => Promise<void>;
}>();

const agentExtras = ref<AgentExtras | null>(null);
const repolling = ref(false);

async function loadFull() {
  try {
    const data = (await fetchAgent(props.agentId)) as AgentExtras | undefined;
    agentExtras.value = data ?? null;
  } catch {
    /* silent — composable already exposes the shape we need for the basics */
  }
}

watch(() => props.agentId, loadFull);
onMounted(loadFull);

async function onRepoll() {
  repolling.value = true;
  try {
    await refreshAgentWMI(props.agentId);
    Notify.create({
      type: "positive",
      message: "Re-poll task queued. The agent will refresh hardware on its next check-in.",
      position: "top",
      timeout: 3500,
    });
    await props.refresh();
    await loadFull();
  } catch (err) {
    const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
      ?.response?.data?.detail ?? (err as { message?: string })?.message ?? "request failed";
    Notify.create({
      type: "negative",
      message: `Couldn't queue re-poll: ${msg}`,
      position: "top",
      timeout: 3500,
    });
  } finally {
    repolling.value = false;
  }
}

const cpuRows = computed(() => {
  const cpus = props.status.cpuModel || agentExtras.value?.cpu_model || [];
  if (cpus.length === 0) return [];
  if (cpus.length === 1) return [cpus[0]];
  return [`${cpus.length}× ${cpus[0]}`];
});

const cpuLogical = computed(() => {
  const cpus = props.status.cpuModel || agentExtras.value?.cpu_model || [];
  return cpus.length || null;
});

const wmi = computed<Record<string, unknown> | null>(
  () => (agentExtras.value?.wmi_detail ?? null) as Record<string, unknown> | null,
);

const serialNumber = computed<string>(() => {
  if (!wmi.value) return "";
  if (props.status.plat === "windows") {
    // Windows wmi_detail.bios is List[List[Dict]]; first row first entry has SerialNumber.
    const bios = (wmi.value as { bios?: unknown[][] }).bios;
    const first = bios?.[0]?.[0] as { SerialNumber?: string } | undefined;
    return first?.SerialNumber ?? "";
  }
  const s = (wmi.value as { serialnumber?: string }).serialnumber;
  return s ?? "";
});

const biosLabel = computed<string>(() => {
  if (!wmi.value) return "";
  if (props.status.plat === "windows") {
    const bios = (wmi.value as { bios?: unknown[][] }).bios;
    const first = bios?.[0]?.[0] as
      | { Manufacturer?: string; SMBIOSBIOSVersion?: string }
      | undefined;
    if (!first) return "";
    return [first.Manufacturer, first.SMBIOSBIOSVersion].filter(Boolean).join(" ");
  }
  return (wmi.value as { bios_vendor?: string }).bios_vendor ?? "";
});

const motherboardLabel = computed<string>(() => {
  if (!wmi.value) return "";
  if (props.status.plat === "windows") {
    const board = (wmi.value as { baseboard?: unknown[][] }).baseboard;
    const first = board?.[0]?.[0] as
      | { Manufacturer?: string; Product?: string }
      | undefined;
    if (!first) return "";
    return [first.Manufacturer, first.Product].filter(Boolean).join(" ");
  }
  return "";
});

const nics = computed<Array<{ name: string; ipv4: string; mac: string }>>(() => {
  const raw = agentExtras.value?.interfaces;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => {
      const addresses = (n.addresses ?? []) as Array<{ family?: string; address?: string }>;
      const v4 =
        addresses.find((a) => (a.family || "").toLowerCase().includes("inet"))?.address ??
        n.ipv4 ??
        "";
      return { name: n.name ?? "—", ipv4: v4, mac: n.mac ?? "" };
    })
    .filter((r) => r.name !== "—" || r.ipv4 || r.mac);
});

function diskClass(percent: number): string {
  if (percent >= 95) return "is-bad";
  if (percent >= 80) return "is-warn";
  return "is-ok";
}
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
  }

  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    @media (max-width: 900px) { grid-template-columns: 1fr; }
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
  &__empty {
    color: var(--color-fg-secondary);
    font-size: 13px;
    padding: 4px 0;
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

.disks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  &__device { font-weight: 600; }
  &__fs { color: var(--color-fg-secondary); font-size: 12px; }
  &__pct { margin-left: auto; color: var(--color-fg-secondary); font-size: 12px; }
  &__bar {
    height: 8px;
    background: var(--color-bg-page);
    border-radius: 999px;
    overflow: hidden;
  }
  &__fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
    &.is-ok   { background: var(--color-state-positive-fg, #117a3a); }
    &.is-warn { background: var(--color-state-warning-fg, #8a5a00); }
    &.is-bad  { background: var(--color-state-negative-fg, #a40e26); }
  }
  &__sub {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
}

.plain {
  list-style: disc;
  padding-left: 20px;
  margin: 0;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.net {
  margin-top: 14px;

  &__title {
    margin: 0 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-secondary);
    font-weight: 600;
  }
  &__table {
    width: 100%;
    font-size: 13px;
    border-collapse: collapse;
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    th {
      color: var(--color-fg-secondary);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }
}
</style>
