<!--
  Phase I — Clients & Sites page.
  New home for the clients/sites tree functionality from the legacy
  DashboardView.vue. The legacy /legacy route still has the tree.

  Phase T3 — per-row right-click menu and BulkActionBar are now feature-
  complete with the legacy tree's op set:
    Toggle Maintenance, Install Agent, Assign Automation Policy,
    Assign Alert Template, Run URL Action, Run Checks, Edit, Delete
    (and Add Site, on a client row).
  Endpoints, dialog components and the AgentInstallWizard are reused —
  no new backend routes were added.
-->
<template>
  <q-page class="cspg">
    <header class="cspg__hero">
      <div>
        <h1 class="cspg__title">Clients &amp; Sites</h1>
        <p class="cspg__lede">
          The directory of every client and site in your fleet. Filter by
          health, group by client, or jump into a site to see what's running.
        </p>
      </div>
      <div class="cspg__hero-actions">
        <q-btn
          unelevated
          color="primary"
          icon="add"
          label="Add Client"
          @click="openAddClient"
        />
        <q-btn
          flat
          color="primary"
          icon="add_business"
          label="Add Site"
          @click="openAddSite"
        />
        <q-btn
          flat
          dense
          icon="refresh"
          color="primary"
          :loading="store.loading"
          @click="store.load()"
        >
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <ClientsSitesFilterBar />

    <BulkActionBar
      v-if="store.selected.length > 0"
      :selected="store.selected as never"
      site-scope
      @run-script="bulkRunScript"
      @run-command="bulkRunCommand"
      @scan-patches="bulkScanPatches"
      @reboot="bulkReboot"
      @clear="store.clearSelection"
      @enable-maintenance="bulkSetMaintenance(true)"
      @disable-maintenance="bulkSetMaintenance(false)"
      @assign-policy="bulkAssignPolicy"
      @assign-alert-template="bulkAssignAlertTemplate"
      @run-url-action="bulkRunURLAction"
      @run-checks-bulk="bulkRunChecks"
    />

    <ClientsSitesTable
      @open-detail="openDetail"
      @open-client="openEditClient"
      @open-client-by-id="openEditClientById"
      @row-context="onRowContext"
    />

    <RowContextMenu
      v-if="ctxRow"
      v-model="ctxOpen"
      :scope="ctxScope"
      :maintenance-on="ctxRow ? rowMaintenanceOn(ctxScope, ctxRow) : false"
      :url-actions="urlActions"
      :url-actions-loading="urlActionsLoading"
      :position="ctxPos"
      @edit="ctxRow && onRowEdit(ctxScope, ctxRow)"
      @delete="ctxRow && onRowDelete(ctxScope, ctxRow)"
      @add-site="ctxRow && onAddSiteFromClient(ctxRow as GroupedClientRow)"
      @toggle-maintenance="ctxRow && onRowToggleMaintenance(ctxScope, ctxRow)"
      @install-agent="ctxRow && onRowInstallAgent(ctxScope, ctxRow)"
      @assign-policy="ctxRow && onRowAssignPolicy(ctxScope, ctxRow)"
      @assign-alert-template="ctxRow && onRowAssignAlertTemplate(ctxScope, ctxRow)"
      @run-url-action="(id) => ctxRow && onRowRunURLAction(ctxScope, ctxRow, id)"
      @run-checks="ctxRow && onRowRunChecks(ctxScope, ctxRow)"
    />

    <SiteDetailDrawer
      v-model="detailOpen"
      :row="detailRow"
      @edit="onEditFromDetail"
      @delete="onDeleteFromDetail"
    />
    <ClientFormDrawer
      v-model="clientDrawerOpen"
      :client="clientDrawerSubject"
      @saved="onAfterWrite"
    />
    <SiteFormDrawer
      v-model="siteDrawerOpen"
      :site="siteDrawerSubject"
      :default-client-id="siteDrawerDefaultClient"
      @saved="onAfterWrite"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { openURL, useQuasar } from "quasar";

import { useClientsSitesStore, type GroupedClientRow } from "@/stores/clientsSites";
import { fetchClient, fetchSite, removeSite, removeClient } from "@/api/clients";
import { notifySuccess } from "@/utils/notify";

import ClientsSitesFilterBar from "@/components/clientsSites/ClientsSitesFilterBar.vue";
import ClientsSitesTable from "@/components/clientsSites/ClientsSitesTable.vue";
import SiteDetailDrawer from "@/components/clientsSites/SiteDetailDrawer.vue";
import ClientFormDrawer from "@/components/clientsSites/ClientFormDrawer.vue";
import SiteFormDrawer from "@/components/clientsSites/SiteFormDrawer.vue";
import RowContextMenu from "@/components/clientsSites/RowContextMenu.vue";

import BulkActionBar from "@/components/devices/BulkActionBar.vue";
import BulkAction from "@/components/modals/agents/BulkAction.vue";
import AgentInstallWizard from "@/components/devices/AgentInstallWizard.vue";

// Reused dialogs from the legacy tree (final modern shape — they are
// scope-aware standalone dialogs, no longer tied to the legacy tree node).
import PolicyAdd from "@/components/automation/modals/PolicyAdd.vue";
import AlertTemplateAdd from "@/components/modals/alerts/AlertTemplateAdd.vue";

import {
  toggleMaintenance,
  runChecksScoped,
  listWebURLActions,
  runURLAction,
  type URLAction,
  type CSScope,
} from "@/api/clientSiteOps";

import type { SiteRow } from "@/components/clientsSites/columns";

type AnyRow = SiteRow | GroupedClientRow;

const $q = useQuasar();
const store = useClientsSitesStore();

onMounted(() => store.load());

// ── Detail drawer ─────────────────────────────────────────────────────────
const detailOpen = ref(false);
const detailRow = ref<SiteRow | null>(null);
function openDetail(row: SiteRow) {
  detailRow.value = row;
  detailOpen.value = true;
}

// ── Client edit drawer ────────────────────────────────────────────────────
const clientDrawerOpen = ref(false);
const clientDrawerSubject = ref<{ id?: number; name: string } | null>(null);
function openAddClient() {
  clientDrawerSubject.value = null;
  clientDrawerOpen.value = true;
}
function openEditClient(row: SiteRow) {
  clientDrawerSubject.value = { id: row.client_id, name: row.client_name };
  clientDrawerOpen.value = true;
}
function openEditClientById(id: number) {
  const r = (store.rows as SiteRow[]).find((x) => x.client_id === id);
  if (!r) return;
  openEditClient(r);
}

// ── Site form drawer ──────────────────────────────────────────────────────
const siteDrawerOpen = ref(false);
const siteDrawerSubject = ref<{ id?: number; client?: number; name: string } | null>(null);
const siteDrawerDefaultClient = ref<number | null>(null);
function openAddSite() {
  siteDrawerSubject.value = null;
  siteDrawerDefaultClient.value = null;
  siteDrawerOpen.value = true;
}
function onAddSiteFromClient(row: GroupedClientRow) {
  siteDrawerSubject.value = null;
  siteDrawerDefaultClient.value = row.client_id;
  siteDrawerOpen.value = true;
}
function onEditFromDetail() {
  if (!detailRow.value) return;
  siteDrawerSubject.value = {
    id: detailRow.value.site_id,
    client: detailRow.value.client_id,
    name: detailRow.value.site_name,
  };
  siteDrawerOpen.value = true;
  detailOpen.value = false;
}
async function onDeleteFromDetail() {
  if (!detailRow.value) return;
  await deleteSiteRow(detailRow.value);
  detailOpen.value = false;
}

function onAfterWrite() {
  // store.reloadAfterWrite is already called by the drawers; nothing else
  // to do here.
}

// ── URL actions cache (lazy; refreshed on first context-menu open) ────────
const urlActions = ref<URLAction[]>([]);
const urlActionsLoading = ref(false);
let urlActionsLoadedAt = 0;
async function ensureURLActions() {
  if (urlActionsLoading.value) return;
  if (Date.now() - urlActionsLoadedAt < 60_000) return;
  urlActionsLoading.value = true;
  try {
    urlActions.value = await listWebURLActions();
    urlActionsLoadedAt = Date.now();
  } catch (e) {
    console.warn("Failed to load URL actions", e);
  } finally {
    urlActionsLoading.value = false;
  }
}
// Trigger a load early so the submenu is populated before users mouse over.
onMounted(() => { void ensureURLActions(); });

// ── Row context menu state ────────────────────────────────────────────────
const ctxOpen = ref(false);
const ctxRow = ref<AnyRow | null>(null);
const ctxScope = ref<CSScope>("site");
const ctxPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });
function onRowContext(payload: {
  scope: CSScope;
  row: AnyRow;
  clientX: number;
  clientY: number;
}) {
  ctxRow.value = payload.row;
  ctxScope.value = payload.scope;
  ctxPos.value = { x: payload.clientX, y: payload.clientY };
  // Re-open: toggle off then on so q-menu re-anchors at the new position.
  ctxOpen.value = false;
  void ensureURLActions();
  setTimeout(() => { ctxOpen.value = true; }, 0);
}

// ── Row helpers ───────────────────────────────────────────────────────────
function rowId(scope: CSScope, row: AnyRow): number {
  return scope === "client"
    ? (row as GroupedClientRow).client_id ?? (row as SiteRow).client_id
    : (row as SiteRow).site_id;
}
function rowLabel(scope: CSScope, row: AnyRow): string {
  return scope === "client"
    ? (row as { client_name: string }).client_name
    : (row as SiteRow).site_name;
}
function rowMaintenanceOn(scope: CSScope, row: AnyRow): boolean {
  // The aggregate flag in the row reflects "any agent in scope is in
  // maintenance"; that's the same heuristic the legacy tree used.
  if (scope === "site") return !!(row as SiteRow).maintenance_mode;
  // Grouped row doesn't carry the flag — fall back to "any site has it".
  const cid = (row as GroupedClientRow).client_id;
  return (store.rows as SiteRow[]).some(
    (s) => s.client_id === cid && s.maintenance_mode,
  );
}

// ── Per-row handlers ──────────────────────────────────────────────────────
function onRowEdit(scope: CSScope, row: AnyRow) {
  if (scope === "client") {
    const r = row as GroupedClientRow;
    clientDrawerSubject.value = { id: r.client_id, name: r.client_name };
    clientDrawerOpen.value = true;
  } else {
    const r = row as SiteRow;
    siteDrawerSubject.value = { id: r.site_id, client: r.client_id, name: r.site_name };
    siteDrawerOpen.value = true;
  }
}

async function deleteSiteRow(row: SiteRow) {
  if (row.agent_count > 0) {
    $q.notify({
      color: "warning",
      message: "Move or remove the agents first — the legacy tree handles that move flow.",
      icon: "warning",
    });
    return;
  }
  $q.dialog({
    title: "Delete site?",
    message: `This will permanently delete <b>${row.site_name}</b>. This cannot be undone.`,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative", flat: false },
  }).onOk(async () => {
    try {
      const result = await removeSite(row.site_id);
      notifySuccess(result);
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
      $q.notify({ color: "negative", message: "Delete failed", icon: "error" });
    }
  });
}

async function deleteClientRow(row: GroupedClientRow) {
  if (row.agent_count > 0) {
    $q.notify({
      color: "warning",
      message: "Client still has agents — move them out first via the legacy tree.",
      icon: "warning",
    });
    return;
  }
  $q.dialog({
    title: "Delete client?",
    message: `This will permanently delete <b>${row.client_name}</b> and all its sites. This cannot be undone.`,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative", flat: false },
  }).onOk(async () => {
    try {
      const result = await removeClient(row.client_id);
      notifySuccess(result);
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
      $q.notify({ color: "negative", message: "Delete failed", icon: "error" });
    }
  });
}

function onRowDelete(scope: CSScope, row: AnyRow) {
  if (scope === "site") void deleteSiteRow(row as SiteRow);
  else void deleteClientRow(row as GroupedClientRow);
}

async function onRowToggleMaintenance(scope: CSScope, row: AnyRow) {
  const id = rowId(scope, row);
  const label = rowLabel(scope, row);
  const turningOn = !rowMaintenanceOn(scope, row);
  $q.dialog({
    title: `${turningOn ? "Enable" : "Disable"} Maintenance Mode?`,
    message: `${turningOn ? "Pauses" : "Resumes"} alerts and checks for every agent under <b>${label}</b>.`,
    html: true,
    cancel: true,
    ok: { label: turningOn ? "Enable" : "Disable", color: turningOn ? "warning" : "primary" },
  }).onOk(async () => {
    try {
      const msg = await toggleMaintenance(scope, id, turningOn);
      notifySuccess(msg);
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
    }
  });
}

function onRowInstallAgent(scope: CSScope, row: AnyRow) {
  const defaults =
    scope === "site"
      ? {
          defaultClientId: (row as SiteRow).client_id,
          defaultSiteId: (row as SiteRow).site_id,
        }
      : { defaultClientId: (row as GroupedClientRow).client_id, defaultSiteId: null };
  $q.dialog({ component: AgentInstallWizard, componentProps: defaults });
}

async function onRowAssignPolicy(scope: CSScope, row: AnyRow) {
  const obj = await loadFullObject(scope, rowId(scope, row));
  if (!obj) return;
  $q.dialog({
    component: PolicyAdd,
    componentProps: { type: scope, object: obj },
  }).onOk(() => store.reloadAfterWrite());
}

async function onRowAssignAlertTemplate(scope: CSScope, row: AnyRow) {
  const obj = await loadFullObject(scope, rowId(scope, row));
  if (!obj) return;
  $q.dialog({
    component: AlertTemplateAdd,
    componentProps: { type: scope, object: obj },
  }).onOk(() => store.reloadAfterWrite());
}

async function onRowRunURLAction(scope: CSScope, row: AnyRow, actionId: number) {
  const id = rowId(scope, row);
  const label = rowLabel(scope, row);
  $q.dialog({
    title: "Run URL Action?",
    message: `Open the configured URL for <b>${label}</b>?`,
    html: true,
    cancel: true,
    ok: { label: "Open", color: "primary" },
  }).onOk(async () => {
    try {
      const url = await runURLAction(scope, id, actionId);
      openURL(url);
    } catch (e) {
      console.error(e);
    }
  });
}

async function onRowRunChecks(scope: CSScope, row: AnyRow) {
  const id = rowId(scope, row);
  const label = rowLabel(scope, row);
  $q.dialog({
    title: "Run all Checks now?",
    message: `Triggers every check on every agent under <b>${label}</b> via NATS.`,
    html: true,
    cancel: true,
    ok: { label: "Run", color: "primary" },
  }).onOk(async () => {
    try {
      const msg = await runChecksScoped(scope, id);
      notifySuccess(msg);
    } catch (e) {
      console.error(e);
    }
  });
}

// PolicyAdd / AlertTemplateAdd both expect the full record (current
// server_policy / workstation_policy / alert_template / block_policy_inheritance
// fields). Our store carries only the slim row shape, so we fetch the full
// object once at dialog-open time.
async function loadFullObject(
  scope: CSScope,
  id: number,
): Promise<Record<string, unknown> | null> {
  try {
    const obj = scope === "client" ? await fetchClient(id) : await fetchSite(id);
    if (!obj) {
      $q.notify({ color: "negative", message: `Could not load ${scope} #${id}`, icon: "error" });
      return null;
    }
    return obj as Record<string, unknown>;
  } catch (e) {
    console.error(e);
    $q.notify({ color: "negative", message: "Failed to load record", icon: "error" });
    return null;
  }
}

// ── Bulk actions ──────────────────────────────────────────────────────────
// Reuse Phase C's BulkAction dialog. The dialog accepts an `agents` array of
// agent_ids; we union the agents under each selected site.
import { useDevicesStore } from "@/stores/devices";
const devices = useDevicesStore();

const selectedAgentIds = computed<string[]>(() => {
  const siteIds = new Set((store.selected as SiteRow[]).map((s) => s.site_id));
  const out: string[] = [];
  for (const a of devices.rows) {
    if (siteIds.has(a.site as number)) out.push(a.agent_id);
  }
  return out;
});

function bulkRunScript() {
  if (selectedAgentIds.value.length === 0) {
    return $q.notify({ color: "warning", message: "No agents in selected sites." });
  }
  $q.dialog({
    component: BulkAction,
    componentProps: { mode: "script", agents: selectedAgentIds.value },
  });
}
function bulkRunCommand() {
  if (selectedAgentIds.value.length === 0) {
    return $q.notify({ color: "warning", message: "No agents in selected sites." });
  }
  $q.dialog({
    component: BulkAction,
    componentProps: { mode: "command", agents: selectedAgentIds.value },
  });
}
function bulkScanPatches() {
  if (selectedAgentIds.value.length === 0) {
    return $q.notify({ color: "warning", message: "No agents in selected sites." });
  }
  $q.dialog({
    component: BulkAction,
    componentProps: { mode: "patch", agents: selectedAgentIds.value },
  });
}
function bulkReboot() {
  // Reboot intentionally NOT wired here — Phase I is read-leaning. Reboot is
  // available in /devices where the user already has agent-row context.
  $q.notify({
    color: "warning",
    message: "Use /devices for bulk reboot — reboots are agent-scoped.",
  });
}

// Phase T3 — site-scope bulk handlers. Sites are the selection unit; each
// op fans out across the selected sites.
function bulkSetMaintenance(on: boolean) {
  const sites = store.selected as SiteRow[];
  if (sites.length === 0) return;
  $q.dialog({
    title: `${on ? "Enable" : "Disable"} Maintenance Mode on ${sites.length} site${sites.length > 1 ? "s" : ""}?`,
    message: `${on ? "Pauses" : "Resumes"} alerts and checks across every agent in the selected sites.`,
    cancel: true,
    ok: { label: on ? "Enable" : "Disable", color: on ? "warning" : "primary" },
  }).onOk(async () => {
    try {
      await Promise.all(sites.map((s) => toggleMaintenance("site", s.site_id, on)));
      $q.notify({
        color: "positive",
        message: `Maintenance ${on ? "enabled" : "disabled"} on ${sites.length} site${sites.length > 1 ? "s" : ""}.`,
        icon: "check_circle",
      });
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
    }
  });
}

async function bulkAssignPolicy() {
  const sites = store.selected as SiteRow[];
  if (sites.length === 0) return;
  // Use the first site to seed the dialog's current values; the dialog
  // submits the user's chosen policies to the same fields and we then
  // mirror that submit across the rest of the selection.
  const seed = await loadFullObject("site", sites[0].site_id);
  if (!seed) return;
  $q.dialog({
    component: PolicyAdd,
    componentProps: { type: "site", object: { ...seed } },
  }).onOk(async () => {
    // PolicyAdd already PUT the values onto the seed site. Mirror to the
    // others by re-reading the seed (it now has the chosen values) and
    // PUTing them onto each other selected site.
    try {
      const fresh = await fetchSite(sites[0].site_id);
      if (!fresh) return;
      const payload = {
        site: {
          server_policy: (fresh as Record<string, unknown>).server_policy,
          workstation_policy: (fresh as Record<string, unknown>).workstation_policy,
          block_policy_inheritance: (fresh as Record<string, unknown>).block_policy_inheritance,
        },
      };
      const { editSite } = await import("@/api/clients");
      const others = sites.slice(1);
      await Promise.all(others.map((s) => editSite(s.site_id, payload)));
      $q.notify({
        color: "positive",
        message: `Policy applied to ${sites.length} site${sites.length > 1 ? "s" : ""}.`,
        icon: "check_circle",
      });
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
    }
  });
}

async function bulkAssignAlertTemplate() {
  const sites = store.selected as SiteRow[];
  if (sites.length === 0) return;
  const seed = await loadFullObject("site", sites[0].site_id);
  if (!seed) return;
  $q.dialog({
    component: AlertTemplateAdd,
    componentProps: { type: "site", object: { ...seed } },
  }).onOk(async () => {
    try {
      const fresh = await fetchSite(sites[0].site_id);
      if (!fresh) return;
      const payload = {
        site: {
          id: 0,
          alert_template: (fresh as Record<string, unknown>).alert_template,
        },
      };
      const { editSite } = await import("@/api/clients");
      const others = sites.slice(1);
      await Promise.all(
        others.map((s) =>
          editSite(s.site_id, { site: { ...payload.site, id: s.site_id } }),
        ),
      );
      $q.notify({
        color: "positive",
        message: `Alert template applied to ${sites.length} site${sites.length > 1 ? "s" : ""}.`,
        icon: "check_circle",
      });
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
    }
  });
}

async function bulkRunURLAction() {
  const sites = store.selected as SiteRow[];
  if (sites.length === 0) return;
  await ensureURLActions();
  if (urlActions.value.length === 0) {
    $q.notify({
      color: "warning",
      message: "No URL Actions configured. Settings > URL Actions.",
    });
    return;
  }
  // Single-action picker dialog; runs the action against each selected site
  // and opens each rendered URL in a new tab (browsers may block N>1 popups
  // so we warn at high counts).
  $q.dialog({
    title: "Pick a URL Action",
    options: {
      type: "radio",
      model: urlActions.value[0].id,
      items: urlActions.value.map((a) => ({ label: a.name, value: a.id })),
    },
    cancel: true,
    ok: { label: "Run", color: "primary" },
  }).onOk(async (actionId: number) => {
    if (sites.length > 5) {
      const ok = await new Promise<boolean>((resolve) => {
        $q.dialog({
          title: "Open many tabs?",
          message: `This will try to open ${sites.length} browser tabs. Your browser may block popups.`,
          cancel: true,
          ok: { label: "Continue", color: "primary" },
        })
          .onOk(() => resolve(true))
          .onCancel(() => resolve(false));
      });
      if (!ok) return;
    }
    try {
      const urls = await Promise.all(
        sites.map((s) => runURLAction("site", s.site_id, actionId)),
      );
      for (const u of urls) openURL(u);
    } catch (e) {
      console.error(e);
    }
  });
}

async function bulkRunChecks() {
  const sites = store.selected as SiteRow[];
  if (sites.length === 0) return;
  $q.dialog({
    title: `Run Checks across ${sites.length} site${sites.length > 1 ? "s" : ""}?`,
    message: "Triggers every check on every agent in scope via NATS.",
    cancel: true,
    ok: { label: "Run", color: "primary" },
  }).onOk(async () => {
    try {
      const msgs = await Promise.all(
        sites.map((s) => runChecksScoped("site", s.site_id)),
      );
      $q.notify({
        color: "positive",
        message: msgs.join(" / "),
        icon: "check_circle",
        multiLine: true,
      });
    } catch (e) {
      console.error(e);
    }
  });
}
</script>

<style lang="scss" scoped>
.cspg {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 16px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.1;
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0;
    max-width: 720px;
  }
  &__hero-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
