<!--
  Phase L — ScriptsPage.
  Owns the /scripts route under AppShell. Three tabs:
    Library      — table of all scripts (default)
    Run history  — fleet-wide /agents/scripthistory/
    Scheduled    — read-only /tasks/ list (Phase N owns the editor)

  Tabs are URL-driven so deep-links from the editor or other pages land
  on the right pane.
-->
<template>
  <q-page class="scripts">
    <header class="scripts__hero">
      <div>
        <h1 class="scripts__title">Scripts</h1>
        <p class="scripts__lede">
          The script library, run history, and scheduled tasks. Author and run
          PowerShell, Batch, Python, Bash, Nushell, and Deno scripts across the
          fleet.
        </p>
      </div>
      <div class="scripts__hero-meta">
        <q-btn
          v-if="tab === 'library'"
          unelevated
          color="primary"
          icon="add"
          label="New script"
          @click="onNew"
        />
        <q-btn
          v-if="tab === 'library'"
          flat
          icon="upload_file"
          label="Import"
          @click="importOpen = true"
        />
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
      class="scripts__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="library"     icon="code"      label="Library" />
      <q-tab name="runhistory"  icon="history"   label="Run history" />
      <q-tab name="scheduled"   icon="schedule"  label="Scheduled" />
    </q-tabs>
    <q-separator class="scripts__tab-sep" />

    <q-tab-panels v-model="tab" animated swipeable keep-alive class="scripts__panels">
      <q-tab-panel name="library" class="scripts__panel">
        <ScriptsLibraryTab
          ref="libraryRef"
          @open-script="openDrawer"
          @new-script="onNew"
        />
      </q-tab-panel>
      <q-tab-panel name="runhistory" class="scripts__panel">
        <ScriptsRunHistoryTab ref="historyRef" />
      </q-tab-panel>
      <q-tab-panel name="scheduled" class="scripts__panel">
        <ScriptsScheduledTab ref="scheduledRef" />
      </q-tab-panel>
    </q-tab-panels>

    <!-- Drawer editor — single-click on a row opens here. -->
    <ScriptEditorDrawer
      v-model="drawerOpen"
      :script-id="drawerScriptId"
      @saved="onSaved"
      @deleted="onDeleted"
    />

    <ScriptImportModal
      v-model="importOpen"
      @imported="onImported"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

import ScriptsLibraryTab    from "@/components/scripts/ScriptsLibraryTab.vue";
import ScriptsRunHistoryTab from "@/components/scripts/ScriptsRunHistoryTab.vue";
import ScriptsScheduledTab  from "@/components/scripts/ScriptsScheduledTab.vue";
import ScriptEditorDrawer   from "@/components/scripts/ScriptEditorDrawer.vue";
import ScriptImportModal    from "@/components/scripts/ScriptImportModal.vue";

const route  = useRoute();
const router = useRouter();

type TabName = "library" | "runhistory" | "scheduled";
const tab = ref<TabName>(parseTab(route.query.tab));

function parseTab(q: unknown): TabName {
  if (q === "runhistory" || q === "scheduled" || q === "library") return q;
  return "library";
}

watch(tab, (v) => {
  if (route.query.tab === v) return;
  void router.replace({ query: { ...route.query, tab: v } });
});

watch(() => route.query.tab, (q) => {
  const next = parseTab(q);
  if (next !== tab.value) tab.value = next;
});

// drawer state
const drawerOpen     = ref(false);
const drawerScriptId = ref<number | null>(null);

function openDrawer(id: number) {
  drawerScriptId.value = id;
  drawerOpen.value = true;
}

function onNew() {
  // For new scripts we use the full page so the user has room to write.
  void router.push({ name: "ScriptNew" });
}

function onSaved() {
  // After save, refresh the library list silently.
  if (libraryRef.value && typeof (libraryRef.value as { reload?: () => void }).reload === "function") {
    (libraryRef.value as { reload: () => void }).reload();
  }
}

function onDeleted() {
  drawerOpen.value = false;
  drawerScriptId.value = null;
  onSaved();
}

const libraryRef   = ref<InstanceType<typeof ScriptsLibraryTab> | null>(null);
const historyRef   = ref<InstanceType<typeof ScriptsRunHistoryTab> | null>(null);
const scheduledRef = ref<InstanceType<typeof ScriptsScheduledTab> | null>(null);

const importOpen = ref(false);
function onImported() {
  importOpen.value = false;
  onSaved();
}

function reload() {
  if (tab.value === "library" && libraryRef.value) (libraryRef.value as { reload?: () => void }).reload?.();
  if (tab.value === "runhistory" && historyRef.value) (historyRef.value as { reload?: () => void }).reload?.();
  if (tab.value === "scheduled" && scheduledRef.value) (scheduledRef.value as { reload?: () => void }).reload?.();
}

onMounted(() => {
  // First load happens inside each tab. No-op here.
});

// Computed currently-active tab is used in template above.
void computed;
</script>

<style lang="scss" scoped>
.scripts {
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
