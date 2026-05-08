<!--
  ChecksPage — Phase M /checks route under AppShell.

  Two tabs:
    Library     — fleet-wide table of all checks (default).
    Run history — fleet-wide CheckResult feed via GET /checks/runs/.

  Tab is URL-driven via ?tab= so deep-links land on the right pane.
-->
<template>
  <q-page class="checks">
    <header class="checks__hero">
      <div>
        <h1 class="checks__title">Checks</h1>
        <p class="checks__lede">
          The check library and fleet-wide run history. Disk space, CPU,
          memory, ping, services, scripts, and event-log checks across every
          agent and policy.
        </p>
      </div>
      <div class="checks__hero-meta">
        <q-btn
          flat
          dense
          icon="refresh"
          color="primary"
          @click="reload"
        >
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <q-tabs
      v-model="tab"
      class="checks__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="library"    icon="checklist"  label="Library" />
      <q-tab name="runhistory" icon="history"    label="Run history" />
    </q-tabs>
    <q-separator class="checks__tab-sep" />

    <q-tab-panels v-model="tab" animated swipeable keep-alive class="checks__panels">
      <q-tab-panel name="library" class="checks__panel">
        <ChecksLibraryTab ref="libraryRef" />
      </q-tab-panel>
      <q-tab-panel name="runhistory" class="checks__panel">
        <ChecksRunHistoryTab ref="historyRef" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import ChecksLibraryTab    from "@/components/checks/ChecksLibraryTab.vue";
import ChecksRunHistoryTab from "@/components/checks/ChecksRunHistoryTab.vue";

const route  = useRoute();
const router = useRouter();

function parseTab(q) {
  return q === "runhistory" || q === "library" ? q : "library";
}

const tab = ref(parseTab(route.query.tab));

watch(tab, (v) => {
  if (route.query.tab === v) return;
  void router.replace({ query: { ...route.query, tab: v } });
});

watch(() => route.query.tab, (q) => {
  const next = parseTab(q);
  if (next !== tab.value) tab.value = next;
});

const libraryRef = ref(null);
const historyRef = ref(null);

function reload() {
  if (tab.value === "library" && libraryRef.value?.reload) libraryRef.value.reload();
  if (tab.value === "runhistory" && historyRef.value?.reload) historyRef.value.reload();
}
</script>

<style lang="scss" scoped>
.checks {
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
  &__hero-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__tabs {
    margin-top: 12px;
  }
  &__tab-sep {
    margin-bottom: 4px;
  }
  &__panels {
    background: transparent;
  }
  &__panel {
    padding: 12px 0 0 0;
  }
}
</style>
