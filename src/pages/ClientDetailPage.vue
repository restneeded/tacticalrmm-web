<!--
  Phase T7 — Client detail page (/clients/:id under AppShell).

  Hero: name + breadcrumb (Clients > <name>) + agent/failing-checks badges.
  Tabs (URL-driven via ?tab=, mirrors Phase J / Phase O):
    - Sites       embedded sites table filtered to this client
    - Agents      embedded agents table filtered to this client
    - Automation  policies + alert template (PolicyChip-style chrome)
    - Alerts      recent alerts via fetchAlerts({clientFilter: [id]})

  Notes tab is intentionally absent — the Client model has no notes
  field (only name, policies, alert_template, custom_fields). Documented
  in Supermemory for Phase Z.

  Edit / Delete reuse the existing ClientFormDrawer and the same
  agents-must-be-moved-first warning behaviour from ClientsSitesPage.
-->
<template>
  <q-page class="cdp">
    <header class="cdp__hero">
      <div class="cdp__crumbs">
        <router-link :to="{ name: 'ClientsSites' }" class="cdp__crumb">Clients</router-link>
        <q-icon name="chevron_right" size="14px" class="cdp__crumb-sep" />
        <span class="cdp__crumb cdp__crumb--current">{{ client?.name || `#${id}` }}</span>
      </div>

      <div v-if="loading && !client" class="cdp__state">
        <q-circular-progress indeterminate size="24px" color="primary" />
        <span>Loading client…</span>
      </div>
      <div v-else-if="errorMsg" class="cdp__state cdp__state--error">
        <q-icon name="error_outline" /> {{ errorMsg }}
      </div>
      <div v-else-if="!client" class="cdp__state">
        <q-icon name="search_off" />
        <span>No client with id <code>{{ id }}</code>.</span>
      </div>
      <div v-else class="cdp__head">
        <div class="cdp__head-left">
          <h1 class="cdp__title">{{ client.name }}</h1>
          <div class="cdp__chips">
            <span class="cdp__chip">{{ siteCount }} site{{ siteCount === 1 ? '' : 's' }}</span>
            <span class="cdp__chip">{{ agentCount }} agent{{ agentCount === 1 ? '' : 's' }}</span>
            <span
              v-if="failingChecksCount > 0"
              class="cdp__chip cdp__chip--negative"
              :title="`${failingChecksCount} failing check${failingChecksCount === 1 ? '' : 's'} across this client's agents`"
            >{{ failingChecksCount }} failing</span>
            <span v-if="lastSeen" class="cdp__chip cdp__chip--ghost">last poll {{ relTime(lastSeen) }}</span>
          </div>
        </div>
        <div class="cdp__head-right">
          <q-btn flat dense icon="refresh" :loading="loading" @click="reload" no-caps label="Refresh" />
          <q-btn unelevated color="primary" icon="edit" label="Edit" no-caps @click="onEdit" />
          <q-btn flat color="negative" icon="delete" label="Delete" no-caps @click="onDelete" />
        </div>
      </div>
    </header>

    <q-tabs
      v-if="client"
      v-model="tab"
      class="cdp__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="sites"      icon="apartment"            :label="`Sites (${siteCount})`" />
      <q-tab name="agents"     icon="computer"             :label="`Agents (${agentCount})`" />
      <q-tab name="automation" icon="policy"               label="Automation" />
      <q-tab name="alerts"     icon="notifications_active" :label="`Alerts${alertsCount != null ? ` (${alertsCount})` : ''}`" />
    </q-tabs>
    <q-separator v-if="client" class="cdp__tab-sep" />

    <q-tab-panels v-if="client" v-model="tab" animated keep-alive class="cdp__panels">
      <!-- ── Sites ───────────────────────────────────────────────── -->
      <q-tab-panel name="sites" class="cdp__panel">
        <q-table
          :rows="sitesRows"
          :columns="sitesColumns"
          row-key="site_id"
          :loading="csStore.loading"
          flat
          square
          binary-state-sort
          :rows-per-page-options="[25, 50, 100, 0]"
          no-data-label="No sites for this client."
          @row-click="(_e: unknown, row: any) => goSite(row.site_id)"
        >
          <template #body-cell-site_name="props">
            <q-td :props="props">
              <a class="cdp__link" href="#" @click.prevent="goSite(props.row.site_id)">{{ props.row.site_name }}</a>
            </q-td>
          </template>
          <template #body-cell-last_seen="props">
            <q-td :props="props">
              <span :title="props.row.last_seen || ''">{{ relTime(props.row.last_seen) }}</span>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ── Agents ──────────────────────────────────────────────── -->
      <q-tab-panel name="agents" class="cdp__panel">
        <q-table
          :rows="agentRows"
          :columns="agentColumns"
          row-key="agent_id"
          :loading="devices.loading"
          flat
          square
          binary-state-sort
          :rows-per-page-options="[25, 50, 100, 0]"
          no-data-label="No agents under this client."
          @row-click="(_e: unknown, row: any) => goAgent(row.agent_id)"
        >
          <template #body-cell-hostname="props">
            <q-td :props="props">
              <a class="cdp__link" href="#" @click.prevent="goAgent(props.row.agent_id)">{{ props.row.hostname }}</a>
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <span :class="`cdp__pill cdp__pill--${statusTone(props.row.status)}`">{{ props.row.status || 'unknown' }}</span>
            </q-td>
          </template>
          <template #body-cell-last_seen="props">
            <q-td :props="props">
              <span :title="props.row.last_seen || ''">{{ relTime(props.row.last_seen) }}</span>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ── Automation ──────────────────────────────────────────── -->
      <q-tab-panel name="automation" class="cdp__panel">
        <div class="cdp__auto">
          <div class="cdp__auto-row">
            <div class="cdp__auto-label">Server policy</div>
            <div class="cdp__auto-value">
              <PolicyChip v-if="client.server_policy" :policy-id="serverPolicyId(client)" :name="serverPolicyName(client)" />
              <span v-else class="cdp__muted">— not set —</span>
            </div>
          </div>
          <div class="cdp__auto-row">
            <div class="cdp__auto-label">Workstation policy</div>
            <div class="cdp__auto-value">
              <PolicyChip v-if="client.workstation_policy" :policy-id="wsPolicyId(client)" :name="wsPolicyName(client)" />
              <span v-else class="cdp__muted">— not set —</span>
            </div>
          </div>
          <div class="cdp__auto-row">
            <div class="cdp__auto-label">Block inheritance</div>
            <div class="cdp__auto-value">
              <q-icon v-if="client.block_policy_inheritance" name="block" size="16px" />
              {{ client.block_policy_inheritance ? "Inheritance blocked" : "Inheritance allowed" }}
            </div>
          </div>
          <div class="cdp__auto-row">
            <div class="cdp__auto-label">Alert template</div>
            <div class="cdp__auto-value">
              <span v-if="alertTemplateLabel">{{ alertTemplateLabel }}</span>
              <span v-else class="cdp__muted">— not set —</span>
            </div>
          </div>
          <div class="cdp__auto-actions">
            <q-btn unelevated color="primary" icon="policy" label="Assign Automation Policy" no-caps @click="onAssignPolicy" />
            <q-btn flat icon="notifications" label="Assign Alert Template" no-caps @click="onAssignAlertTemplate" />
          </div>
        </div>
      </q-tab-panel>

      <!-- ── Alerts ──────────────────────────────────────────────── -->
      <q-tab-panel name="alerts" class="cdp__panel">
        <div class="cdp__alerts-bar">
          <q-btn flat dense icon="refresh" :loading="alertsLoading" @click="loadAlerts" no-caps label="Refresh" />
          <span class="cdp__muted">Most recent first · last 100 unresolved + unsnoozed</span>
        </div>
        <q-table
          :rows="alerts"
          :columns="alertColumns"
          row-key="id"
          :loading="alertsLoading"
          flat
          square
          binary-state-sort
          :rows-per-page-options="[25, 50, 100, 0]"
          no-data-label="No alerts for this client."
        >
          <template #body-cell-severity="props">
            <q-td :props="props">
              <span :class="`cdp__pill cdp__pill--${alertTone(props.row.severity)}`">{{ props.row.severity }}</span>
            </q-td>
          </template>
          <template #body-cell-alert_time="props">
            <q-td :props="props">
              <span :title="props.row.alert_time || ''">{{ relTime(props.row.alert_time) }}</span>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <ClientFormDrawer
      v-model="editOpen"
      :client="editSubject"
      @saved="reload"
    />
  </q-page>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any --
   The Client/Site/Alert/Policy union shapes (server_policy: number | {id,name}|null,
   alert rows from /alerts/, agent rows from devices store) are narrow-cast
   inline rather than carrying full type imports. Mirrors clientsSites.ts. */
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar, date } from "quasar";

import { fetchClient, removeClient } from "@/api/clients";
import { fetchAlerts } from "@/api/alerts";
import { fetchAlertTemplates } from "@/api/alerts";
import { useClientsSitesStore } from "@/stores/clientsSites";
import { useDevicesStore } from "@/stores/devices";
import { notifySuccess } from "@/utils/notify";

import ClientFormDrawer from "@/components/clientsSites/ClientFormDrawer.vue";
import PolicyChip from "@/components/policies/PolicyChip.vue";
import PolicyAdd from "@/components/automation/modals/PolicyAdd.vue";
import AlertTemplateAdd from "@/components/modals/alerts/AlertTemplateAdd.vue";

interface ClientShape {
  id: number;
  name: string;
  block_policy_inheritance?: boolean;
  server_policy?: number | { id: number; name: string } | null;
  workstation_policy?: number | { id: number; name: string } | null;
  alert_template?: number | null;
  failing_checks?: { error: boolean; warning: boolean } | null;
}

const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const csStore = useClientsSitesStore();
const devices = useDevicesStore();

const id = computed(() => Number(route.params.id));

const client = ref<ClientShape | null>(null);
const loading = ref(true);
const errorMsg = ref("");

// Tab persistence (?tab=) — same shape as Phase O.
const TABS = ["sites", "agents", "automation", "alerts"] as const;
type TabName = (typeof TABS)[number];
function parseTab(q: unknown): TabName {
  return (TABS as readonly string[]).includes(String(q)) ? (String(q) as TabName) : "sites";
}
const tab = ref<TabName>(parseTab(route.query.tab));
watch(tab, (v) => {
  if (route.query.tab === v) return;
  void router.replace({ query: { ...route.query, tab: v === "sites" ? undefined : v } });
});
watch(() => route.query.tab, (q) => {
  const next = parseTab(q);
  if (next !== tab.value) tab.value = next;
});

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = await fetchClient(id.value);
    client.value = (data ?? null) as ClientShape | null;
    // Preload sites/agents store for the embedded tables.
    if (csStore.apiClients.length === 0) void csStore.load();
    if (devices.rows.length === 0) void devices.loadAgents();
  } catch (e) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string };
    errorMsg.value = err.response?.data?.detail || err.message || "Couldn't load client";
  } finally {
    loading.value = false;
  }
}
onMounted(() => { void reload(); });
watch(id, () => { void reload(); });

// Hero/badge counts derived from the clientsSites store rows.
const sitesRows = computed(() => csStore.rows.filter((r) => r.client_id === id.value));
const siteCount = computed(() => sitesRows.value.length);
const agentCount = computed(() => sitesRows.value.reduce((acc, r) => acc + r.agent_count, 0));
const failingChecksCount = computed(() => sitesRows.value.reduce((acc, r) => acc + r.failing_checks, 0));
const lastSeen = computed<string | null>(() => {
  let best: string | null = null;
  for (const r of sitesRows.value) {
    if (r.last_seen && (best === null || r.last_seen > best)) best = r.last_seen;
  }
  return best;
});

// Agents under this client — devices store is the canonical source.
const agentRows = computed(() => {
  if (!client.value) return [];
  const cn = client.value.name;
  return devices.rows.filter((r: any) => r.client_name === cn);
});

// ─── Sites table ─────────────────────────────────────────────────────
const sitesColumns = [
  { name: "site_name",      label: "Site",        field: "site_name",      sortable: true, align: "left" },
  { name: "agent_count",    label: "Agents",      field: "agent_count",    sortable: true, align: "right" },
  { name: "failing_checks", label: "Failing",     field: "failing_checks", sortable: true, align: "right" },
  { name: "patches_pending",label: "Patches",     field: "patches_pending",sortable: true, align: "right" },
  { name: "last_seen",      label: "Last seen",   field: "last_seen",      sortable: true, align: "left" },
] as const;

// ─── Agents table ─────────────────────────────────────────────────────
const agentColumns = [
  { name: "hostname",  label: "Hostname",         field: "hostname",        sortable: true, align: "left" },
  { name: "site_name", label: "Site",             field: "site_name",       sortable: true, align: "left" },
  { name: "status",    label: "Status",           field: "status",          sortable: true, align: "left" },
  { name: "operating_system", label: "OS",        field: "operating_system",sortable: true, align: "left" },
  { name: "last_seen", label: "Last check-in",    field: "last_seen",       sortable: true, align: "left" },
] as const;

function statusTone(s: string | undefined): string {
  if (s === "online") return "positive";
  if (s === "offline") return "warning";
  if (s === "overdue") return "negative";
  return "neutral";
}

// ─── Automation tab helpers ──────────────────────────────────────────
function serverPolicyId(c: ClientShape): number {
  const p = c.server_policy as any;
  return typeof p === "number" ? p : (p?.id ?? 0);
}
function serverPolicyName(c: ClientShape): string {
  const p = c.server_policy as any;
  return typeof p === "object" && p?.name ? p.name : String(p ?? "policy");
}
function wsPolicyId(c: ClientShape): number {
  const p = c.workstation_policy as any;
  return typeof p === "number" ? p : (p?.id ?? 0);
}
function wsPolicyName(c: ClientShape): string {
  const p = c.workstation_policy as any;
  return typeof p === "object" && p?.name ? p.name : String(p ?? "policy");
}

const alertTemplates = ref<Array<{ id: number; name: string }>>([]);
const alertTemplateLabel = computed(() => {
  if (!client.value?.alert_template) return null;
  const at = client.value.alert_template;
  if (typeof at === "object" && (at as any)?.name) return (at as any).name;
  const found = alertTemplates.value.find((t) => t.id === Number(at));
  return found?.name ?? `Template #${at}`;
});
onMounted(async () => {
  try { alertTemplates.value = await fetchAlertTemplates(); } catch { /* best-effort */ }
});

function onAssignPolicy() {
  if (!client.value) return;
  $q.dialog({
    component: PolicyAdd,
    componentProps: { type: "client", object: { ...client.value } },
  }).onOk(() => reload());
}
function onAssignAlertTemplate() {
  if (!client.value) return;
  $q.dialog({
    component: AlertTemplateAdd,
    componentProps: { type: "client", object: { ...client.value } },
  }).onOk(() => reload());
}

// ─── Alerts tab ──────────────────────────────────────────────────────
const alerts = ref<any[]>([]);
const alertsCount = ref<number | null>(null);
const alertsLoading = ref(false);
const alertColumns = [
  { name: "severity",   label: "Severity",   field: "severity",   sortable: true, align: "left" },
  { name: "alert_type", label: "Type",       field: "alert_type", sortable: true, align: "left" },
  { name: "message",    label: "Message",    field: "message",    sortable: false, align: "left" },
  { name: "hostname",   label: "Agent",      field: "hostname",   sortable: true, align: "left" },
  { name: "alert_time", label: "Triggered",  field: "alert_time", sortable: true, align: "left" },
] as const;

function alertTone(s: string): string {
  if (s === "error") return "negative";
  if (s === "warning") return "warning";
  return "neutral";
}

async function loadAlerts() {
  alertsLoading.value = true;
  try {
    const data = await fetchAlerts({ clientFilter: [id.value], resolvedFilter: false, snoozedFilter: false });
    alerts.value = (data ?? []) as any[];
    alertsCount.value = alerts.value.length;
  } catch (e) {
    console.warn("Failed to load alerts", e);
  } finally {
    alertsLoading.value = false;
  }
}
watch(tab, (v) => { if (v === "alerts" && alerts.value.length === 0) void loadAlerts(); }, { immediate: true });

// ─── Edit / delete ───────────────────────────────────────────────────
const editOpen = ref(false);
const editSubject = computed(() => (client.value ? { id: client.value.id, name: client.value.name } : null));
function onEdit() { editOpen.value = true; }

function onDelete() {
  if (!client.value) return;
  const c = client.value;
  if (agentCount.value > 0) {
    $q.notify({
      color: "warning",
      message: "Client still has agents — move them out first via Clients & Sites.",
      icon: "warning",
    });
    return;
  }
  $q.dialog({
    title: "Delete client?",
    message: `This will permanently delete <b>${c.name}</b> and all its sites. This cannot be undone.`,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      const result = await removeClient(c.id);
      notifySuccess(result);
      void router.push({ name: "ClientsSites" });
    } catch (e) {
      console.error(e);
      $q.notify({ color: "negative", message: "Delete failed", icon: "error" });
    }
  });
}

// ─── Navigation ──────────────────────────────────────────────────────
function goAgent(agentId: string) { void router.push(`/devices/${agentId}`); }
function goSite(siteId: number) { void router.push(`/sites/${siteId}`); }

// ─── Misc ────────────────────────────────────────────────────────────
function relTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return date.formatDate(d, "YYYY-MM-DD");
}
</script>

<style lang="scss" scoped>
.cdp {
  padding: 24px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero { margin-bottom: 8px; }
  &__crumbs { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; font-size: 13px; }
  &__crumb {
    color: var(--color-link, #1c70d8);
    text-decoration: none;
    &--current { color: var(--color-fg-secondary); pointer-events: none; }
    &:hover:not(&--current) { text-decoration: underline; }
  }
  &__crumb-sep { color: var(--color-fg-tertiary); }

  &__state {
    display: flex; align-items: center; gap: 8px;
    padding: 16px 0; color: var(--color-fg-secondary);
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
  }
  &__head-left { min-width: 0; }
  &__head-right { display: flex; gap: 8px; align-items: center; }

  &__title {
    margin: 0 0 6px 0;
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.1;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }

  &__chips { display: flex; flex-wrap: wrap; gap: 6px; }
  &__chip {
    display: inline-flex; align-items: center; height: 22px; padding: 0 10px;
    border-radius: 999px; font-size: 11px; font-weight: 600;
    border: 1px solid var(--color-stroke-divider);
    background: var(--color-bg-surface);
    color: var(--color-fg-secondary);
    &--negative {
      background: var(--color-state-negative-bg, #fde7e9);
      color: var(--color-state-negative-fg, #a40e26);
      border-color: transparent;
    }
    &--ghost { background: transparent; }
  }

  &__tabs { margin-top: 16px; }
  &__tab-sep { margin-bottom: 4px; }
  &__panels { background: transparent; }
  &__panel { padding: 16px 0 0 0; }

  &__link {
    color: var(--color-brand-rest, #0078d4);
    text-decoration: none;
    font-weight: var(--intune-font-weight-medium);
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }

  &__pill {
    display: inline-flex; align-items: center; height: 22px; padding: 0 10px;
    border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize;
    border: 1px solid var(--color-stroke-divider);
    background: var(--color-bg-surface);
    color: var(--color-fg-secondary);
    &--positive { background: var(--color-state-positive-bg, #e6f6ed); color: var(--color-state-positive-fg, #117a3a); border-color: transparent; }
    &--warning  { background: var(--color-state-warning-bg, #fff5e0);  color: var(--color-state-warning-fg, #8a5a00);  border-color: transparent; }
    &--negative { background: var(--color-state-negative-bg, #fde7e9); color: var(--color-state-negative-fg, #a40e26); border-color: transparent; }
  }

  &__auto {
    display: flex; flex-direction: column; gap: 12px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 20px 24px; max-width: 720px;
  }
  &__auto-row { display: flex; gap: 16px; align-items: baseline; }
  &__auto-label {
    width: 180px; flex: none;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-secondary);
    text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600;
  }
  &__auto-value { flex: 1; min-width: 0; }
  &__auto-actions { display: flex; gap: 8px; margin-top: 8px; }

  &__muted { color: var(--color-fg-tertiary); }

  &__alerts-bar {
    display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
  }
}
</style>
