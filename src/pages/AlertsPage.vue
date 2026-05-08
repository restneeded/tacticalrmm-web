<!--
  AlertsPage — Phase P /alerts route under AppShell.

  Three tabs:
    Active     — unresolved alerts table.
    History    — resolved-only audit trail (paginated, read-only).
    Templates  — list of AlertTemplate; click → /alerts/templates/:id.

  Tab is URL-driven via ?tab= so deep-links land on the right pane and the
  Phase B "Pending alerts" tile + Phase J Agent Detail "alerts" links can
  preserve the filter via query string.

  Mirrors Phase O PoliciesPage chrome (hero + tabs + tab-panels).
-->
<template>
  <q-page class="alp">
    <header class="alp__hero">
      <div>
        <h1 class="alp__title">Alerts</h1>
        <p class="alp__lede">
          Live view of what is currently broken across the fleet, the
          resolved history, and the templates that decide who gets paged
          and how.
        </p>
      </div>
      <div class="alp__hero-meta">
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
      class="alp__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="active"    icon="notifications_active" label="Active" />
      <q-tab name="history"   icon="history"              label="History" />
      <q-tab name="templates" icon="tune"                 label="Templates" />
    </q-tabs>
    <q-separator class="alp__tab-sep" />

    <q-tab-panels v-model="tab" animated swipeable keep-alive class="alp__panels">
      <q-tab-panel name="active" class="alp__panel">
        <AlertsActiveTab ref="activeRef" />
      </q-tab-panel>
      <q-tab-panel name="history" class="alp__panel">
        <AlertsHistoryTab ref="historyRef" />
      </q-tab-panel>
      <q-tab-panel name="templates" class="alp__panel">
        <AlertTemplatesTab ref="templatesRef" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import AlertsActiveTab    from "@/components/alerts/AlertsActiveTab.vue";
import AlertsHistoryTab   from "@/components/alerts/AlertsHistoryTab.vue";
import AlertTemplatesTab  from "@/components/alerts/AlertTemplatesTab.vue";

const route  = useRoute();
const router = useRouter();

function parseTab(q) {
  return q === "history" || q === "templates" || q === "active" ? q : "active";
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

const activeRef    = ref(null);
const historyRef   = ref(null);
const templatesRef = ref(null);

function reload() {
  if (tab.value === "active"    && activeRef.value?.reload)    activeRef.value.reload();
  if (tab.value === "history"   && historyRef.value?.reload)   historyRef.value.reload();
  if (tab.value === "templates" && templatesRef.value?.reload) templatesRef.value.reload();
}
</script>

<style lang="scss" scoped>
.alp {
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
