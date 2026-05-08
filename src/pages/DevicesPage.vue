<!--
  DevicesPage (Phase C) — new home for the agent list.
  Replaces the splitter+tree+table inside the legacy DashboardView for
  everyday device management. Legacy view is still reachable at /legacy.

  Phase K: adds the Install Agent wizard launcher in the header, extends
  bulk actions with reboot/shutdown/uninstall/recover-services/notify (all
  via the new async /agents/actions/bulk/ pattern that returns {job_id}),
  and shows a Recent Bulk Operations panel above the table.
-->
<template>
  <q-page class="devices">
    <header class="devices__hero">
      <div>
        <h1 class="devices__title">Devices</h1>
        <p class="devices__lede">
          Inventory, health, and remote-control for every endpoint. Filter,
          search, and act on agents in bulk.
        </p>
      </div>
      <div class="devices__hero-meta">
        <span class="devices__count">
          {{ filteredCount.toLocaleString() }} of
          {{ totalCount.toLocaleString() }} agents
        </span>
        <q-btn
          unelevated
          color="primary"
          icon="install_desktop"
          label="Install Agent"
          @click="openInstallWizard"
        />
        <q-btn
          flat
          dense
          icon="refresh"
          color="primary"
          :loading="store.loading"
          @click="store.loadAgents({ force: true })"
        >
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <DevicesFilterBar />

    <BulkOpsPanel ref="opsPanelRef" />

    <BulkActionBar
      v-if="store.selected.length > 0"
      :selected="store.selected"
      @run-script="bulkRunScript"
      @run-command="bulkRunCommand"
      @scan-patches="bulkScanPatches"
      @reboot="bulkReboot"
      @shutdown="bulkShutdown"
      @uninstall="bulkUninstall"
      @recover-services="bulkRecoverServices"
      @notify="bulkNotify"
      @clear="store.clearSelection"
    />

    <DevicesTable @open-detail="openDetail" />

    <DetailDrawer
      v-model="drawerOpen"
      :agent="drawerAgent"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import { useDevicesStore } from "@/stores/devices";
import { dispatchBulkOp, type AgentRow, type BulkOp } from "@/api/devices";

import DevicesFilterBar from "@/components/devices/DevicesFilterBar.vue";
import DevicesTable from "@/components/devices/DevicesTable.vue";
import BulkActionBar from "@/components/devices/BulkActionBar.vue";
import BulkOpsPanel from "@/components/devices/BulkOpsPanel.vue";
import DetailDrawer from "@/components/devices/DetailDrawer.vue";
import AgentInstallWizard from "@/components/devices/AgentInstallWizard.vue";

// Legacy bulk dialog, fully reused — same form the legacy DashboardView
// has been driving for years. Phase C is the new chrome around it.
import BulkAction from "@/components/modals/agents/BulkAction.vue";

const $q = useQuasar();
const store = useDevicesStore();
const opsPanelRef = ref<InstanceType<typeof BulkOpsPanel> | null>(null);

onMounted(() => store.loadAgents());

const totalCount = computed(() => store.rows.length);
const filteredCount = computed(() => store.filteredRows.length);

// ── Install wizard (Phase K) ───────────────────────────────────────────────
function openInstallWizard() {
  $q.dialog({ component: AgentInstallWizard });
}

// ── Detail drawer ──────────────────────────────────────────────────────────
const drawerOpen = ref(false);
const drawerAgent = ref<AgentRow | null>(null);
function openDetail(agent: AgentRow) {
  drawerAgent.value = agent;
  drawerOpen.value = true;
}

// ── Bulk actions ───────────────────────────────────────────────────────────
// Existing modes still go through the legacy BulkAction dialog.
function bulkRunScript()    { $q.dialog({ component: BulkAction, componentProps: { mode: "script"  } }); }
function bulkRunCommand()   { $q.dialog({ component: BulkAction, componentProps: { mode: "command" } }); }
function bulkScanPatches()  { $q.dialog({ component: BulkAction, componentProps: { mode: "patch"   } }); }

// Phase K — async dispatch via /agents/actions/bulk/ with mode=<op>.
function selectedAgentIds(): string[] {
  return store.selected.map((a) => a.agent_id);
}

async function dispatchAndNotify(
  op: BulkOp,
  successLabel: string,
  extra: { message?: string } = {},
) {
  const ids = selectedAgentIds();
  if (!ids.length) return;
  try {
    const res = await dispatchBulkOp(op, ids, extra);
    $q.notify({
      color: "positive",
      icon: "check_circle",
      message: res.message || `${successLabel} dispatched.`,
    });
    // refresh the panel so the new job appears immediately
    void opsPanelRef.value?.refresh?.();
    store.clearSelection();
  } catch (err) {
    const detail =
      (err as { response?: { data?: string | { detail?: string } } })
        .response?.data;
    const msg =
      typeof detail === "string"
        ? detail
        : detail?.detail ?? `${successLabel} failed.`;
    $q.notify({ color: "negative", message: msg });
  }
}

function confirm(opts: { title: string; message: string; okLabel: string }) {
  return $q.dialog({
    title: opts.title,
    message: opts.message,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: opts.okLabel, color: "negative", flat: false },
  });
}

function bulkReboot() {
  const n = store.selected.length;
  confirm({
    title: "Reboot selected agents?",
    message: `Are you sure? <b>${n}</b> agent${n === 1 ? "" : "s"} will reboot.`,
    okLabel: "Reboot",
  }).onOk(() => dispatchAndNotify("reboot", "Reboot"));
}

function bulkShutdown() {
  const n = store.selected.length;
  confirm({
    title: "Shutdown selected agents?",
    message: `Are you sure? <b>${n}</b> agent${n === 1 ? "" : "s"} will shut down.`,
    okLabel: "Shutdown",
  }).onOk(() => dispatchAndNotify("shutdown", "Shutdown"));
}

function bulkUninstall() {
  const n = store.selected.length;
  confirm({
    title: "Uninstall agents?",
    message:
      `<b>${n}</b> agent${n === 1 ? "" : "s"} will go offline permanently. ` +
      `Re-installing requires running the installer again.`,
    okLabel: "Uninstall",
  }).onOk(() => dispatchAndNotify("uninstall", "Uninstall"));
}

function bulkRecoverServices() {
  void dispatchAndNotify("recover-services", "Service recovery");
}

function bulkNotify() {
  $q.dialog({
    title: "Send notification",
    message: "Message to display on each agent's tray:",
    prompt: { model: "", type: "text", isValid: (v: string) => !!v },
    cancel: true,
    persistent: true,
  }).onOk((message: string) => {
    void dispatchAndNotify("notify", "Notification", { message });
  });
}
</script>

<style lang="scss" scoped>
.devices {
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
  &__hero-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    white-space: nowrap;
  }
  &__count {
    font-variant-numeric: tabular-nums;
  }
}
</style>
