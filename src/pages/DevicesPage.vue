<!--
  DevicesPage (Phase C) — new home for the agent list.
  Replaces the splitter+tree+table inside the legacy DashboardView for
  everyday device management. Legacy view is still reachable at /legacy.
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

    <BulkActionBar
      v-if="store.selected.length > 0"
      :selected="store.selected"
      @run-script="bulkRunScript"
      @run-command="bulkRunCommand"
      @scan-patches="bulkScanPatches"
      @reboot="bulkReboot"
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
import { rebootAgent, type AgentRow } from "@/api/devices";

import DevicesFilterBar from "@/components/devices/DevicesFilterBar.vue";
import DevicesTable from "@/components/devices/DevicesTable.vue";
import BulkActionBar from "@/components/devices/BulkActionBar.vue";
import DetailDrawer from "@/components/devices/DetailDrawer.vue";

// Legacy bulk dialog, fully reused — same form the legacy DashboardView
// has been driving for years. Phase C is the new chrome around it.
import BulkAction from "@/components/modals/agents/BulkAction.vue";

const $q = useQuasar();
const store = useDevicesStore();

onMounted(() => store.loadAgents());

const totalCount = computed(() => store.rows.length);
const filteredCount = computed(() => store.filteredRows.length);

// ── Detail drawer ──────────────────────────────────────────────────────────
const drawerOpen = ref(false);
const drawerAgent = ref<AgentRow | null>(null);
function openDetail(agent: AgentRow) {
  drawerAgent.value = agent;
  drawerOpen.value = true;
}

// ── Bulk actions ───────────────────────────────────────────────────────────
// "Run script" / "Run command" / "Scan patches" — reuse the legacy BulkAction
// dialog component directly (Phase C is chrome, not a re-implementation of
// every form). The dialog already speaks to /agents/actions/bulk/.
function bulkRunScript()    { $q.dialog({ component: BulkAction, componentProps: { mode: "script"  } }); }
function bulkRunCommand()   { $q.dialog({ component: BulkAction, componentProps: { mode: "command" } }); }
function bulkScanPatches()  { $q.dialog({ component: BulkAction, componentProps: { mode: "patch"   } }); }

// "Reboot selected" — no native bulk endpoint; iterate single-agent reboot.
// Always confirms first; never silently fans out POSTs.
function bulkReboot() {
  const selected = [...store.selected];
  if (!selected.length) return;
  $q.dialog({
    title: "Reboot selected agents?",
    message: `This will request a reboot on <b>${selected.length}</b> agent${
      selected.length === 1 ? "" : "s"
    }. Each agent reboots independently — there is no "undo".`,
    html: true,
    cancel: true,
    persistent: true,
    ok: { label: "Reboot", color: "negative", flat: false },
  }).onOk(async () => {
    let ok = 0, fail = 0;
    for (const a of selected) {
      try { await rebootAgent(a.agent_id); ok += 1; }
      catch { fail += 1; }
    }
    $q.notify({
      color: fail ? "warning" : "positive",
      message:
        fail > 0
          ? `Reboot requested on ${ok}; ${fail} failed.`
          : `Reboot requested on ${ok} agent${ok === 1 ? "" : "s"}.`,
      icon: fail ? "warning" : "check_circle",
    });
    store.clearSelection();
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
