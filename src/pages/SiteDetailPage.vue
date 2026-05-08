<!--
  Phase T7 — Site detail page (/sites/:id under AppShell).

  Hero: site name + breadcrumb (Clients > <client> > <site>) + agent badge.
  Tabs (URL-driven via ?tab=, mirrors Phase J / Phase O):
    - Agents      embedded agents table filtered to this site
    - Automation  policies + alert template (mirrors Client detail)
    - Alerts      alerts.fetchAlerts uses siteFilter (Phase Z) for
                  server-side narrowing.

  Edit / Delete reuse the existing SiteFormDrawer and the same
  agents-must-be-moved-first warning behaviour from ClientsSitesPage.
-->
<template>
  <q-page class="sdp">
    <header class="sdp__hero">
      <div class="sdp__crumbs">
        <router-link :to="{ name: 'ClientsSites' }" class="sdp__crumb">Clients</router-link>
        <q-icon name="chevron_right" size="14px" class="sdp__crumb-sep" />
        <router-link
          v-if="clientId"
          :to="{ name: 'ClientDetail', params: { id: clientId } }"
          class="sdp__crumb"
        >{{ clientName || `#${clientId}` }}</router-link>
        <q-icon name="chevron_right" size="14px" class="sdp__crumb-sep" />
        <span class="sdp__crumb sdp__crumb--current">{{ site?.name || `#${id}` }}</span>
      </div>

      <div v-if="loading && !site" class="sdp__state">
        <q-circular-progress indeterminate size="24px" color="primary" />
        <span>Loading site…</span>
      </div>
      <div v-else-if="errorMsg" class="sdp__state sdp__state--error">
        <q-icon name="error_outline" /> {{ errorMsg }}
      </div>
      <div v-else-if="!site" class="sdp__state">
        <q-icon name="search_off" />
        <span>No site with id <code>{{ id }}</code>.</span>
      </div>
      <div v-else class="sdp__head">
        <div class="sdp__head-left">
          <h1 class="sdp__title">{{ site.name }}</h1>
          <div class="sdp__chips">
            <span class="sdp__chip">{{ agentCount }} agent{{ agentCount === 1 ? '' : 's' }}</span>
            <span
              v-if="failingChecks > 0"
              class="sdp__chip sdp__chip--negative"
            >{{ failingChecks }} failing</span>
            <span v-if="lastSeen" class="sdp__chip sdp__chip--ghost">last poll {{ relTime(lastSeen) }}</span>
          </div>
        </div>
        <div class="sdp__head-right">
          <q-btn flat dense icon="refresh" :loading="loading" @click="reload" no-caps label="Refresh" />
          <q-btn unelevated color="primary" icon="edit" label="Edit" no-caps @click="onEdit" />
          <q-btn flat color="negative" icon="delete" label="Delete" no-caps @click="onDelete" />
        </div>
      </div>
    </header>

    <q-tabs
      v-if="site"
      v-model="tab"
      class="sdp__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="agents"     icon="computer"             :label="`Agents (${agentCount})`" />
      <q-tab name="automation" icon="policy"               label="Automation" />
      <q-tab name="alerts"     icon="notifications_active" :label="`Alerts${alertsCount != null ? ` (${alertsCount})` : ''}`" />
    </q-tabs>
    <q-separator v-if="site" class="sdp__tab-sep" />

    <q-tab-panels v-if="site" v-model="tab" animated keep-alive class="sdp__panels">
      <!-- ── Agents ──────────────────────────────────────────────── -->
      <q-tab-panel name="agents" class="sdp__panel">
        <q-table
          :rows="agentRows"
          :columns="agentColumns"
          row-key="agent_id"
          :loading="devices.loading"
          flat
          square
          binary-state-sort
          :rows-per-page-options="[25, 50, 100, 0]"
          no-data-label="No agents under this site."
          @row-click="(_e: unknown, row: any) => goAgent(row.agent_id)"
        >
          <template #body-cell-hostname="props">
            <q-td :props="props">
              <a class="sdp__link" href="#" @click.prevent="goAgent(props.row.agent_id)">{{ props.row.hostname }}</a>
            </q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <span :class="`sdp__pill sdp__pill--${statusTone(props.row.status)}`">{{ props.row.status || 'unknown' }}</span>
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
      <q-tab-panel name="automation" class="sdp__panel">
        <div class="sdp__auto">
          <div class="sdp__auto-row">
            <div class="sdp__auto-label">Server policy</div>
            <div class="sdp__auto-value">
              <PolicyChip v-if="site.server_policy" :policy-id="serverPolicyId(site)" :name="serverPolicyName(site)" />
              <span v-else class="sdp__muted">— not set —</span>
            </div>
          </div>
          <div class="sdp__auto-row">
            <div class="sdp__auto-label">Workstation policy</div>
            <div class="sdp__auto-value">
              <PolicyChip v-if="site.workstation_policy" :policy-id="wsPolicyId(site)" :name="wsPolicyName(site)" />
              <span v-else class="sdp__muted">— not set —</span>
            </div>
          </div>
          <div class="sdp__auto-row">
            <div class="sdp__auto-label">Block inheritance</div>
            <div class="sdp__auto-value">
              <q-icon v-if="site.block_policy_inheritance" name="block" size="16px" />
              {{ site.block_policy_inheritance ? "Inheritance blocked" : "Inheritance allowed" }}
            </div>
          </div>
          <div class="sdp__auto-row">
            <div class="sdp__auto-label">Alert template</div>
            <div class="sdp__auto-value">
              <span v-if="alertTemplateLabel">{{ alertTemplateLabel }}</span>
              <span v-else class="sdp__muted">— not set —</span>
            </div>
          </div>
          <div class="sdp__auto-actions">
            <q-btn unelevated color="primary" icon="policy" label="Assign Automation Policy" no-caps @click="onAssignPolicy" />
            <q-btn flat icon="notifications" label="Assign Alert Template" no-caps @click="onAssignAlertTemplate" />
          </div>
        </div>
      </q-tab-panel>

      <!-- ── Alerts ──────────────────────────────────────────────── -->
      <q-tab-panel name="alerts" class="sdp__panel">
        <div class="sdp__alerts-bar">
          <q-btn flat dense icon="refresh" :loading="alertsLoading" @click="loadAlerts" no-caps label="Refresh" />
          <span class="sdp__muted">Most recent first · filtered server-side by site</span>
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
          no-data-label="No alerts for this site."
        >
          <template #body-cell-severity="props">
            <q-td :props="props">
              <span :class="`sdp__pill sdp__pill--${alertTone(props.row.severity)}`">{{ props.row.severity }}</span>
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

    <SiteFormDrawer
      v-model="editOpen"
      :site="editSubject"
      :default-client-id="clientId"
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

import { fetchSite, removeSite } from "@/api/clients";
import { fetchAlerts, fetchAlertTemplates } from "@/api/alerts";
import { useClientsSitesStore } from "@/stores/clientsSites";
import { useDevicesStore } from "@/stores/devices";
import { notifySuccess } from "@/utils/notify";

import SiteFormDrawer from "@/components/clientsSites/SiteFormDrawer.vue";
import PolicyChip from "@/components/policies/PolicyChip.vue";
import PolicyAdd from "@/components/automation/modals/PolicyAdd.vue";
import AlertTemplateAdd from "@/components/modals/alerts/AlertTemplateAdd.vue";

interface SiteShape {
  id: number;
  name: string;
  client?: number | { id: number; name: string };
  block_policy_inheritance?: boolean;
  server_policy?: number | { id: number; name: string } | null;
  workstation_policy?: number | { id: number; name: string } | null;
  alert_template?: number | null;
}

const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const csStore = useClientsSitesStore();
const devices = useDevicesStore();

const id = computed(() => Number(route.params.id));

const site = ref<SiteShape | null>(null);
const loading = ref(true);
const errorMsg = ref("");

const clientId = computed<number | null>(() => {
  const c = site.value?.client as any;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && c.id != null) return c.id;
  // Fall back to looking up via the Phase I store (rows carry both ids).
  const row = csStore.rows.find((r) => r.site_id === id.value);
  return row?.client_id ?? null;
});

const clientName = computed<string | null>(() => {
  const c = site.value?.client as any;
  if (c && typeof c === "object" && c.name) return c.name;
  const row = csStore.rows.find((r) => r.site_id === id.value);
  return row?.client_name ?? null;
});

// Tab persistence (?tab=).
const TABS = ["agents", "automation", "alerts"] as const;
type TabName = (typeof TABS)[number];
function parseTab(q: unknown): TabName {
  return (TABS as readonly string[]).includes(String(q)) ? (String(q) as TabName) : "agents";
}
const tab = ref<TabName>(parseTab(route.query.tab));
watch(tab, (v) => {
  if (route.query.tab === v) return;
  void router.replace({ query: { ...route.query, tab: v === "agents" ? undefined : v } });
});
watch(() => route.query.tab, (q) => {
  const next = parseTab(q);
  if (next !== tab.value) tab.value = next;
});

async function reload() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = await fetchSite(id.value);
    site.value = (data ?? null) as SiteShape | null;
    if (csStore.apiClients.length === 0) void csStore.load();
    if (devices.rows.length === 0) void devices.loadAgents();
  } catch (e) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string };
    errorMsg.value = err.response?.data?.detail || err.message || "Couldn't load site";
  } finally {
    loading.value = false;
  }
}
onMounted(() => { void reload(); });
watch(id, () => { void reload(); });

// Hero / badges from store row.
const storeRow = computed(() => csStore.rows.find((r) => r.site_id === id.value));
const agentCount = computed(() => storeRow.value?.agent_count ?? 0);
const failingChecks = computed(() => storeRow.value?.failing_checks ?? 0);
const lastSeen = computed<string | null>(() => storeRow.value?.last_seen ?? null);

// Agents under this site.
const agentRows = computed(() => devices.rows.filter((r: any) => r.site === id.value));

// ─── Agents table ────────────────────────────────────────────────────
const agentColumns = [
  { name: "hostname",         label: "Hostname",      field: "hostname",         sortable: true, align: "left" },
  { name: "status",           label: "Status",        field: "status",           sortable: true, align: "left" },
  { name: "operating_system", label: "OS",            field: "operating_system", sortable: true, align: "left" },
  { name: "monitoring_type",  label: "Type",          field: "monitoring_type",  sortable: true, align: "left" },
  { name: "last_seen",        label: "Last check-in", field: "last_seen",        sortable: true, align: "left" },
] as const;

function statusTone(s: string | undefined): string {
  if (s === "online") return "positive";
  if (s === "offline") return "warning";
  if (s === "overdue") return "negative";
  return "neutral";
}

// ─── Automation tab helpers (mirror ClientDetailPage) ───────────────
function serverPolicyId(o: SiteShape): number {
  const p = o.server_policy as any;
  return typeof p === "number" ? p : (p?.id ?? 0);
}
function serverPolicyName(o: SiteShape): string {
  const p = o.server_policy as any;
  return typeof p === "object" && p?.name ? p.name : String(p ?? "policy");
}
function wsPolicyId(o: SiteShape): number {
  const p = o.workstation_policy as any;
  return typeof p === "number" ? p : (p?.id ?? 0);
}
function wsPolicyName(o: SiteShape): string {
  const p = o.workstation_policy as any;
  return typeof p === "object" && p?.name ? p.name : String(p ?? "policy");
}

const alertTemplates = ref<Array<{ id: number; name: string }>>([]);
const alertTemplateLabel = computed(() => {
  if (!site.value?.alert_template) return null;
  const at = site.value.alert_template;
  if (typeof at === "object" && (at as any)?.name) return (at as any).name;
  const found = alertTemplates.value.find((t) => t.id === Number(at));
  return found?.name ?? `Template #${at}`;
});
onMounted(async () => {
  try { alertTemplates.value = await fetchAlertTemplates(); } catch { /* best-effort */ }
});

function onAssignPolicy() {
  if (!site.value) return;
  $q.dialog({
    component: PolicyAdd,
    componentProps: { type: "site", object: { ...site.value } },
  }).onOk(() => reload());
}
function onAssignAlertTemplate() {
  if (!site.value) return;
  $q.dialog({
    component: AlertTemplateAdd,
    componentProps: { type: "site", object: { ...site.value } },
  }).onOk(() => reload());
}

// ─── Alerts tab ──────────────────────────────────────────────────────
// Phase Z: fetchAlerts now accepts siteFilter; the PATCH /alerts/
// handler filters server-side, so JS-side narrowing is gone.
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
  if (id.value == null) { alerts.value = []; alertsCount.value = 0; return; }
  alertsLoading.value = true;
  try {
    const data = await fetchAlerts({ siteFilter: [id.value], resolvedFilter: false, snoozedFilter: false });
    alerts.value = (data ?? []) as any[];
    alertsCount.value = alerts.value.length;
  } catch (e) {
    console.warn("Failed to load alerts", e);
  } finally {
    alertsLoading.value = false;
  }
}
watch(tab, (v) => { if (v === "alerts" && alerts.value.length === 0) void loadAlerts(); }, { immediate: true });
// Reload when the route param changes (rare — same page, different :id).
watch(id, (v) => { if (v != null && tab.value === "alerts") void loadAlerts(); });

// ─── Edit / delete ───────────────────────────────────────────────────
const editOpen = ref(false);
const editSubject = computed(() => {
  if (!site.value || clientId.value == null) return null;
  return { id: site.value.id, client: clientId.value, name: site.value.name };
});
function onEdit() { editOpen.value = true; }

function onDelete() {
  if (!site.value) return;
  const s = site.value;
  if (agentCount.value > 0) {
    $q.notify({
      color: "warning",
      message: "Move or remove the agents first — the legacy tree handles that move flow.",
      icon: "warning",
    });
    return;
  }
  $q.dialog({
    title: "Delete site?",
    message: `This will permanently delete <b>${s.name}</b>. This cannot be undone.`,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      const result = await removeSite(s.id);
      notifySuccess(result);
      if (clientId.value != null) {
        void router.push({ name: "ClientDetail", params: { id: clientId.value } });
      } else {
        void router.push({ name: "ClientsSites" });
      }
    } catch (e) {
      console.error(e);
      $q.notify({ color: "negative", message: "Delete failed", icon: "error" });
    }
  });
}

// ─── Navigation ──────────────────────────────────────────────────────
function goAgent(agentId: string) { void router.push(`/devices/${agentId}`); }

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
.sdp {
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

  &__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
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
