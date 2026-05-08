<!--
  PolicyDetailPage — Phase O /policies/:id under AppShell.

  Layout: persistent header (name, desc, badges, toggles, alert template)
  + tabs (Checks / Tasks / Assignments / Win Update). The brief calls out
  putting WinUpdate inline unless cluttered — we tab it because its form
  is dense enough to deserve its own viewport without scrolling past
  Checks/Tasks/Assignments first.

  Backend: see api/automation.js helpers — reads PolicySerializer (full),
  PolicyRelatedSerializer (for assignments), and the policy-scoped
  GET /automation/policies/<id>/{checks,tasks}/ aliases.
-->
<template>
  <q-page class="pdp">
    <header class="pdp__hero">
      <div class="pdp__breadcrumbs">
        <router-link :to="{ name: 'Policies' }" class="pdp__crumb">Policies</router-link>
        <q-icon name="chevron_right" size="14px" class="pdp__crumb-sep" />
        <span class="pdp__crumb pdp__crumb--current">{{ policy?.name || `#${id}` }}</span>
      </div>

      <div v-if="loading" class="pdp__state">Loading policy…</div>
      <div v-else-if="errorMsg" class="pdp__state pdp__state--error">
        <q-icon name="error_outline" /> {{ errorMsg }}
      </div>
      <PolicyHeader
        v-else-if="policy"
        :policy="policy"
        :saving="saving"
        @update="onHeaderUpdate"
      />
    </header>

    <q-tabs
      v-if="policy"
      v-model="tab"
      class="pdp__tabs"
      align="left"
      no-caps
      inline-label
      indicator-color="primary"
      active-color="primary"
    >
      <q-tab name="checks"      icon="checklist"  :label="`Checks${checksCount != null ? ` (${checksCount})` : ''}`" />
      <q-tab name="tasks"       icon="schedule"   :label="`Tasks${tasksCount != null ? ` (${tasksCount})` : ''}`" />
      <q-tab name="assignments" icon="account_tree" label="Assignments" />
      <q-tab name="winupdate"   icon="system_update" label="Windows Update" />
    </q-tabs>
    <q-separator class="pdp__tab-sep" v-if="policy" />

    <q-tab-panels v-if="policy" v-model="tab" animated keep-alive class="pdp__panels">
      <q-tab-panel name="checks" class="pdp__panel">
        <PolicyChecksSection
          :policy-id="policy.id ?? policy.pk"
          :policy-name="policy.name"
          @count="(n) => (checksCount = n)"
        />
      </q-tab-panel>
      <q-tab-panel name="tasks" class="pdp__panel">
        <PolicyTasksSection
          :policy-id="policy.id ?? policy.pk"
          :policy-name="policy.name"
          @count="(n) => (tasksCount = n)"
        />
      </q-tab-panel>
      <q-tab-panel name="assignments" class="pdp__panel">
        <PolicyAssignmentsSection
          :policy-id="policy.id ?? policy.pk"
          :policy-name="policy.name"
          :excluded-clients="policy.excluded_clients || []"
          :excluded-sites="policy.excluded_sites || []"
          :excluded-agents="policy.excluded_agents || []"
          @reload="reload"
        />
      </q-tab-panel>
      <q-tab-panel name="winupdate" class="pdp__panel">
        <PolicyWinUpdateSection
          :policy-id="policy.id ?? policy.pk"
          :win-update-policies="policy.winupdatepolicy || []"
          @reload="reload"
        />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchPolicy, updatePolicy } from "@/api/automation";
import { notifySuccess, notifyError } from "@/utils/notify";

import PolicyHeader            from "@/components/policies/PolicyHeader.vue";
import PolicyChecksSection     from "@/components/policies/PolicyChecksSection.vue";
import PolicyTasksSection      from "@/components/policies/PolicyTasksSection.vue";
import PolicyAssignmentsSection from "@/components/policies/PolicyAssignmentsSection.vue";
import PolicyWinUpdateSection  from "@/components/policies/PolicyWinUpdateSection.vue";

const route  = useRoute();
const router = useRouter();

const id = computed(() => Number(route.params.id));

const policy   = ref(null);
const loading  = ref(true);
const errorMsg = ref("");
const saving   = ref(false);

function parseTab(q) {
  return ["checks", "tasks", "assignments", "winupdate"].includes(q) ? q : "checks";
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

const checksCount = ref(null);
const tasksCount  = ref(null);

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchPolicy(id.value);
    policy.value = data;
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load policy";
  }
  loading.value = false;
}

onMounted(reload);
watch(id, reload);

async function onHeaderUpdate(payload) {
  saving.value = true;
  try {
    await updatePolicy(id.value, payload);
    Object.assign(policy.value, payload);
    notifySuccess("Saved");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Save failed");
  }
  saving.value = false;
}
</script>

<style lang="scss" scoped>
.pdp {
  padding: 24px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero { margin-bottom: 8px; }
  &__breadcrumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 13px;
  }
  &__crumb {
    color: var(--color-link, #1c70d8);
    text-decoration: none;
    &--current {
      color: var(--color-fg-secondary);
      pointer-events: none;
    }
    &:hover:not(&--current) { text-decoration: underline; }
  }
  &__crumb-sep { color: var(--color-fg-tertiary); }

  &__state {
    padding: 24px 0;
    color: var(--color-fg-secondary);
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }
  &__tabs    { margin-top: 8px; }
  &__tab-sep { margin-bottom: 4px; }
  &__panels  { background: transparent; }
  &__panel   { padding: 16px 0 0 0; }
}
</style>
