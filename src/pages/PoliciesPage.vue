<!--
  PoliciesPage — Phase O /policies route under AppShell.

  Two tabs:
    Library                — fleet-wide table of all Policies (default).
    Assignments overview   — per-Client / per-Site rollup showing which
                             policy is currently bound to each target so
                             admins can audit reach without diving into
                             every detail page.

  Tab is URL-driven via ?tab= so deep-links land on the right pane.
  Mirrors Phase M ChecksPage / Phase N TasksPage chrome exactly so users
  learn one shell.
-->
<template>
  <q-page class="pol">
    <header class="pol__hero">
      <div>
        <h1 class="pol__title">Policies</h1>
        <p class="pol__lede">
          Reusable bundles of Checks, Tasks, and Windows-Update settings —
          assigned to Clients, Sites, or individual Agents and inherited
          down the tree (Agent → Site → Client → Default).
        </p>
      </div>
      <div class="pol__hero-meta">
        <q-btn
          flat dense icon="refresh" color="primary"
          @click="reload"
        >
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </div>
    </header>

    <q-tabs
      v-model="tab"
      class="pol__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="library"     icon="policy"      label="Library" />
      <q-tab name="assignments" icon="account_tree" label="Assignments overview" />
    </q-tabs>
    <q-separator class="pol__tab-sep" />

    <q-tab-panels v-model="tab" animated swipeable keep-alive class="pol__panels">
      <q-tab-panel name="library" class="pol__panel">
        <PoliciesLibraryTab ref="libraryRef" />
      </q-tab-panel>
      <q-tab-panel name="assignments" class="pol__panel">
        <PoliciesAssignmentsTab ref="assignRef" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import PoliciesLibraryTab     from "@/components/policies/PoliciesLibraryTab.vue";
import PoliciesAssignmentsTab from "@/components/policies/PoliciesAssignmentsTab.vue";

const route  = useRoute();
const router = useRouter();

function parseTab(q) {
  return q === "assignments" || q === "library" ? q : "library";
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
const assignRef  = ref(null);

function reload() {
  if (tab.value === "library"     && libraryRef.value?.reload) libraryRef.value.reload();
  if (tab.value === "assignments" && assignRef.value?.reload)  assignRef.value.reload();
}
</script>

<style lang="scss" scoped>
.pol {
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
  &__tabs   { margin-top: 12px; }
  &__tab-sep { margin-bottom: 4px; }
  &__panels { background: transparent; }
  &__panel  { padding: 12px 0 0 0; }
}
</style>
