<!--
  AgentDetailPage — Phase J full build.

  Mounted at /devices/:agent_id under AppShell.
  - Hero block (hostname / OS / version / status / breadcrumb / refresh)
  - Stat band (failing checks, pending actions, patches pending, disks)
  - Tab strip: Overview · Hardware · Software · Scripts · Automation
                · Patches · History · Notes
  - Active tab tracked via ?tab= query param so the back button preserves it.

  Live data flows through useAgentLiveStatus (polled, see composable docstring
  for the design tradeoff). Each tab receives agentId + the live `status` ref
  + a refresh() hook; tabs that need additional data fetch it themselves.
-->
<template>
  <div class="agent-detail">
    <header class="agent-detail__bar">
      <q-btn
        flat
        dense
        icon="arrow_back"
        label="Devices"
        no-caps
        :to="{ name: 'Devices' }"
      />
      <q-space />
      <span v-if="status?.lastSeen" class="agent-detail__lastseen">
        Last poll: {{ formatDate(status.lastSeen) }}
      </span>
      <q-btn
        flat
        dense
        icon="refresh"
        label="Refresh"
        no-caps
        :loading="loading"
        @click="refresh()"
      />
    </header>

    <section class="agent-detail__hero">
      <div v-if="loading && !status" class="agent-detail__loading">
        <q-circular-progress indeterminate size="32px" color="primary" />
        <span>Loading agent…</span>
      </div>

      <div v-else-if="error && !status" class="agent-detail__error">
        <q-icon name="error_outline" size="24px" />
        <div>
          <strong>Couldn't load agent</strong>
          <p>{{ errorLabel }}</p>
        </div>
      </div>

      <div v-else-if="!status" class="agent-detail__empty">
        <q-icon name="search_off" size="32px" />
        <p>No agent found for ID <code>{{ agentId }}</code>.</p>
      </div>

      <div v-else class="agent-detail__summary">
        <div class="agent-detail__heading">
          <h1 class="agent-detail__title">{{ status.hostname || "—" }}</h1>
          <div class="agent-detail__chips">
            <span class="chip" :class="`chip--${statusTone}`">
              {{ status.status || "unknown" }}
            </span>
            <span v-if="stale" class="chip chip--neutral">stale</span>
            <span v-if="status.maintenanceMode" class="chip chip--neutral">maintenance</span>
            <span v-if="status.monitoringType" class="chip chip--neutral">{{ status.monitoringType }}</span>
          </div>
        </div>
        <div class="agent-detail__sub">
          <span>{{ status.client || "—" }}</span>
          <span class="agent-detail__sep">·</span>
          <span>{{ status.siteName || "—" }}</span>
          <span class="agent-detail__sep">·</span>
          <span>{{ status.operatingSystem || "—" }}</span>
          <span class="agent-detail__sep">·</span>
          <span>Agent v{{ status.version || "—" }}</span>
          <span v-if="status.loggedInUser" class="agent-detail__sep">·</span>
          <span v-if="status.loggedInUser">user {{ status.loggedInUser }}</span>
        </div>
      </div>
    </section>

    <section v-if="status" class="agent-detail__stats">
      <div class="stat" :class="{'stat--alert': status.failingChecks > 0}">
        <div class="stat__label">Failing checks</div>
        <div class="stat__value">{{ status.failingChecks }}</div>
        <div class="stat__sub">
          {{ status.checks.passing }} passing · {{ status.checks.warning }} warning
        </div>
      </div>
      <div class="stat" :class="{'stat--alert': status.pendingActionsCount > 0}">
        <div class="stat__label">Pending actions</div>
        <div class="stat__value">{{ status.pendingActionsCount }}</div>
        <div class="stat__sub">queued for next check-in</div>
      </div>
      <div class="stat" :class="{'stat--alert': status.hasPatchesPending}">
        <div class="stat__label">Patches</div>
        <div class="stat__value">{{ status.hasPatchesPending ? "Pending" : "Up to date" }}</div>
        <div class="stat__sub">
          {{ status.needsReboot ? "reboot required" : "no reboot pending" }}
        </div>
      </div>
      <div class="stat">
        <div class="stat__label">Disks</div>
        <div class="stat__value">{{ status.disks.length }}</div>
        <div class="stat__sub" v-if="topDisk">
          {{ topDisk.device }} {{ topDisk.percent }}% used
        </div>
        <div class="stat__sub" v-else>no disk data</div>
      </div>
    </section>

    <section v-if="status" class="agent-detail__tabs">
      <q-tabs
        v-model="activeTab"
        dense
        no-caps
        active-color="primary"
        indicator-color="primary"
        align="left"
        class="agent-detail__tabstrip"
      >
        <q-tab name="overview"   label="Overview" />
        <q-tab name="checks"     label="Checks" />
        <q-tab name="hardware"   label="Hardware" />
        <q-tab name="software"   label="Software" />
        <q-tab name="scripts"    label="Scripts" />
        <q-tab name="automation" label="Automation" />
        <q-tab name="patches"    label="Patches" />
        <q-tab name="history"    label="History" />
        <q-tab name="notes"      label="Notes" />
      </q-tabs>

      <q-tab-panels
        v-model="activeTab"
        animated
        keep-alive
        class="agent-detail__panels"
      >
        <q-tab-panel name="overview">
          <OverviewTab :agent-id="agentId" :status="status" />
        </q-tab-panel>
        <q-tab-panel name="checks">
          <ChecksTab :agent-id="agentId" :agent-label="status?.hostname || agentId" />
        </q-tab-panel>
        <q-tab-panel name="hardware">
          <HardwareTab :agent-id="agentId" :status="status" :refresh="refresh" />
        </q-tab-panel>
        <q-tab-panel name="software">
          <SoftwareTab :agent-id="agentId" />
        </q-tab-panel>
        <q-tab-panel name="scripts">
          <ScriptsTab :agent-id="agentId" />
        </q-tab-panel>
        <q-tab-panel name="automation">
          <AutomationTab :agent-id="agentId" :status="status" />
        </q-tab-panel>
        <q-tab-panel name="patches">
          <PatchesTab :agent-id="agentId" />
        </q-tab-panel>
        <q-tab-panel name="history">
          <HistoryTab :agent-id="agentId" />
        </q-tab-panel>
        <q-tab-panel name="notes">
          <NotesTab :agent-id="agentId" />
        </q-tab-panel>
      </q-tab-panels>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, watch, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAgentLiveStatus } from "@/composables/useAgentLiveStatus";

import OverviewTab   from "@/components/agentDetail/OverviewTab.vue";
import ChecksTab     from "@/components/agentDetail/ChecksTab.vue";
import HardwareTab   from "@/components/agentDetail/HardwareTab.vue";
import SoftwareTab   from "@/components/agentDetail/SoftwareTab.vue";
import ScriptsTab    from "@/components/agentDetail/ScriptsTab.vue";
import AutomationTab from "@/components/agentDetail/AutomationTab.vue";
import PatchesTab    from "@/components/agentDetail/PatchesTab.vue";
import HistoryTab    from "@/components/agentDetail/HistoryTab.vue";
import NotesTab      from "@/components/agentDetail/NotesTab.vue";

const route = useRoute();
const router = useRouter();

const agentId = toRef(() => String(route.params.agent_id ?? ""));
const { status, loading, error, stale, refresh } = useAgentLiveStatus(agentId);

const TAB_NAMES = [
  "overview",
  "checks",
  "hardware",
  "software",
  "scripts",
  "automation",
  "patches",
  "history",
  "notes",
] as const;
type TabName = (typeof TAB_NAMES)[number];

function readTabFromQuery(): TabName {
  const t = String(route.query.tab ?? "");
  return (TAB_NAMES as readonly string[]).includes(t)
    ? (t as TabName)
    : "overview";
}

const activeTab = ref<TabName>(readTabFromQuery());

watch(
  () => route.query.tab,
  () => {
    const next = readTabFromQuery();
    if (next !== activeTab.value) activeTab.value = next;
  },
);

watch(activeTab, (next) => {
  if (next === route.query.tab) return;
  router.replace({
    query: { ...route.query, tab: next === "overview" ? undefined : next },
  });
});

const statusTone = computed(() => {
  const s = status.value?.status;
  if (s === "online") return "positive";
  if (s === "offline") return "warning";
  if (s === "overdue") return "negative";
  return "neutral";
});

const errorLabel = computed(() => {
  const e = error.value as
    | {
        response?: { data?: { detail?: string } };
        message?: string;
      }
    | null;
  if (!e) return "";
  return e.response?.data?.detail || e.message || "Request failed";
});

const topDisk = computed(() => {
  const ds = status.value?.disks ?? [];
  if (ds.length === 0) return null;
  return [...ds].sort((a, b) => b.percent - a.percent)[0];
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
</script>

<style lang="scss" scoped>
.agent-detail {
  padding: 16px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--color-bg-page);
  color: var(--color-fg-primary);
  min-height: 100%;

  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__lastseen {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }

  &__hero {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 20px 24px;
  }

  &__loading,
  &__error,
  &__empty {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    color: var(--color-fg-secondary);
  }

  &__heading {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
  }

  &__chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__sub {
    margin-top: 6px;
    font-size: 13px;
    color: var(--color-fg-secondary);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  &__sep { opacity: 0.5; }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .stat {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;

    &__label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-fg-secondary);
      font-weight: 600;
    }
    &__value {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-fg-primary);
    }
    &__sub {
      font-size: 12px;
      color: var(--color-fg-secondary);
    }
    &--alert {
      .stat__value { color: var(--color-state-warning-fg, #8a5a00); }
    }
  }

  &__tabs {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &__tabstrip {
    border-bottom: 1px solid var(--color-border-subtle);
  }

  &__panels {
    background: transparent;
    min-height: 280px;
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  border: 1px solid var(--color-border-subtle);
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--negative {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
