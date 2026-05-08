<!--
  Phase I — Clients & Sites page.
  New home for the clients/sites tree functionality from the legacy
  DashboardView.vue. The legacy /legacy route still has the tree.
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
      @run-script="bulkRunScript"
      @run-command="bulkRunCommand"
      @scan-patches="bulkScanPatches"
      @reboot="bulkReboot"
      @clear="store.clearSelection"
    />

    <ClientsSitesTable
      @open-detail="openDetail"
      @open-client="openEditClient"
      @open-client-by-id="openEditClientById"
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
import { useQuasar } from "quasar";

import { useClientsSitesStore } from "@/stores/clientsSites";
import { removeSite, removeClient } from "@/api/clients";
import { notifySuccess } from "@/utils/notify";

import ClientsSitesFilterBar from "@/components/clientsSites/ClientsSitesFilterBar.vue";
import ClientsSitesTable from "@/components/clientsSites/ClientsSitesTable.vue";
import SiteDetailDrawer from "@/components/clientsSites/SiteDetailDrawer.vue";
import ClientFormDrawer from "@/components/clientsSites/ClientFormDrawer.vue";
import SiteFormDrawer from "@/components/clientsSites/SiteFormDrawer.vue";

import BulkActionBar from "@/components/devices/BulkActionBar.vue";
import BulkAction from "@/components/modals/agents/BulkAction.vue";

import type { SiteRow } from "@/components/clientsSites/columns";

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
  const row = detailRow.value;
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
      detailOpen.value = false;
      await store.reloadAfterWrite();
    } catch (e) {
      console.error(e);
      $q.notify({ color: "negative", message: "Delete failed", icon: "error" });
    }
  });
}

function onAfterWrite() {
  // store.reloadAfterWrite is already called by the drawers; nothing else
  // to do here.
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

// removeClient kept ref'd so the import stays alive — full client-delete UX
// (with move-to-site) is a future Phase, currently still in the legacy view.
void removeClient;
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
