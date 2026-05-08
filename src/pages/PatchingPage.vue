<!--
  PatchingPage — Phase Q top-level Windows Update surface.

  Tabs: Overview / KBs / Agents / History.
  Tab is URL-driven via ?tab= so deep-links + the Phase B Dashboard
  "Pending updates" tile + Phase O policy editor "Manage fleet patches"
  link can land on a specific pane.
-->
<template>
  <q-page class="pp">
    <header class="pp__hero">
      <div>
        <h1 class="pp__title">Patching</h1>
        <p class="pp__lede">
          Fleet-wide Windows Update visibility and control. Triage by KB
          or by agent, approve or install across the fleet, audit what's
          shipped.
        </p>
      </div>
      <div class="pp__hero-meta">
        <q-btn flat dense icon="refresh" color="primary" @click="reload">
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <q-tabs
      v-model="tab"
      class="pp__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="overview" icon="dashboard"      label="Overview" />
      <q-tab name="kbs"      icon="list_alt"       label="KBs" />
      <q-tab name="agents"   icon="devices"        label="Agents" />
      <q-tab name="history"  icon="history"        label="History" />
    </q-tabs>
    <q-separator class="pp__tab-sep" />

    <q-tab-panels v-model="tab" animated swipeable keep-alive class="pp__panels">
      <q-tab-panel name="overview" class="pp__panel">
        <PatchingOverviewTab ref="overviewRef" @open-kb="openKb" />
      </q-tab-panel>
      <q-tab-panel name="kbs" class="pp__panel">
        <PatchingKBsTab ref="kbsRef" @open-kb="openKb" />
      </q-tab-panel>
      <q-tab-panel name="agents" class="pp__panel">
        <PatchingAgentsTab ref="agentsRef" />
      </q-tab-panel>
      <q-tab-panel name="history" class="pp__panel">
        <PatchingHistoryTab ref="historyRef" />
      </q-tab-panel>
    </q-tab-panels>

    <KBDrawer
      :kb="drawerKb"
      :severity="drawerSeverity"
      @close="drawerKb = null"
      @changed="reload"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import PatchingOverviewTab from "@/components/patching/PatchingOverviewTab.vue";
import PatchingKBsTab      from "@/components/patching/PatchingKBsTab.vue";
import PatchingAgentsTab   from "@/components/patching/PatchingAgentsTab.vue";
import PatchingHistoryTab  from "@/components/patching/PatchingHistoryTab.vue";
import KBDrawer            from "@/components/patching/KBDrawer.vue";

const route = useRoute();
const router = useRouter();

function parseTab(q) {
  if (q === "kbs" || q === "agents" || q === "history" || q === "overview") return q;
  return "overview";
}

const tab = ref(parseTab(route.query.tab));
const drawerKb = ref<string | null>(null);
const drawerSeverity = ref<string | null>(null);

watch(tab, (v) => {
  if (route.query.tab === v) return;
  void router.replace({ query: { ...route.query, tab: v } });
});
watch(
  () => route.query.tab,
  (q) => {
    const next = parseTab(q);
    if (next !== tab.value) tab.value = next;
  },
);

const overviewRef = ref<{ reload: () => void } | null>(null);
const kbsRef      = ref<{ reload: () => void } | null>(null);
const agentsRef   = ref<{ reload: () => void } | null>(null);
const historyRef  = ref<{ reload: () => void } | null>(null);

function reload() {
  if (tab.value === "overview" && overviewRef.value?.reload) overviewRef.value.reload();
  if (tab.value === "kbs"      && kbsRef.value?.reload)      kbsRef.value.reload();
  if (tab.value === "agents"   && agentsRef.value?.reload)   agentsRef.value.reload();
  if (tab.value === "history"  && historyRef.value?.reload)  historyRef.value.reload();
}

function openKb(kb: string) {
  drawerKb.value = kb;
}
</script>

<style lang="scss" scoped>
.pp {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 8px;
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
  &__hero-meta { display: flex; align-items: center; gap: 8px; }
  &__tabs   { margin-top: 12px; }
  &__tab-sep { margin-bottom: 4px; }
  &__panels { background: transparent; }
  &__panel  { padding: 12px 0 0 0; }
}
</style>
