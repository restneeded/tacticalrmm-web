<!--
  PolicyAssignmentsSection — embedded assignments + exclusions for /policies/:id.

  Two halves:
    1. Assignments — clients/sites/agents currently bound to this policy
       (fetched via GET /automation/policies/<id>/related/). Add a target
       through the picker (writes to the target itself: PUT clients/<id>/
       sets workstation_policy/server_policy, PUT agents/<id>/ sets
       policy). Remove a target by clearing that same FK.
    2. Exclusions — clients / sites / agents the policy explicitly
       skips. Editable via PUT /automation/policies/<id>/ with the
       excluded_* arrays (the policy itself owns these).

  Inheritance note shown inline so admins remember the precedence order:
    Agent > Site > Client > Default (CoreSettings).
-->
<template>
  <div class="sec">
    <q-banner class="sec__hint" rounded dense>
      <template #avatar><q-icon name="info" /></template>
      Inheritance: <strong>Agent</strong> ›
      <strong>Site</strong> › <strong>Client</strong> ›
      <strong>Default</strong> (CoreSettings). Workstation and server
      policies are tracked separately on Clients and Sites.
    </q-banner>

    <div v-if="loading && !related" class="sec__state">Loading assignments…</div>
    <div v-else-if="errorMsg" class="sec__state sec__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>

    <template v-else-if="related">
      <!-- ── Assigned ─── -->
      <section class="sec__group">
        <header class="sec__group-head">
          <h3 class="sec__group-title">Assigned to</h3>
          <q-btn
            unelevated color="primary"
            icon="add" label="Assign to target" no-caps size="sm"
            @click="pickerOpen = true"
          />
        </header>

        <AssignmentBucket
          label="Clients (workstation policy)"
          icon="business"
          :rows="related.workstation_clients"
          empty-text="No clients assigned this policy for workstations."
          @remove="(row) => unassign('client_workstation', row)"
        />
        <AssignmentBucket
          label="Clients (server policy)"
          icon="business"
          :rows="related.server_clients"
          empty-text="No clients assigned this policy for servers."
          @remove="(row) => unassign('client_server', row)"
        />
        <AssignmentBucket
          label="Sites (workstation policy)"
          icon="place"
          :rows="related.workstation_sites"
          empty-text="No sites assigned this policy for workstations."
          @remove="(row) => unassign('site_workstation', row)"
        />
        <AssignmentBucket
          label="Sites (server policy)"
          icon="place"
          :rows="related.server_sites"
          empty-text="No sites assigned this policy for servers."
          @remove="(row) => unassign('site_server', row)"
        />
        <AssignmentBucket
          label="Agents (direct override)"
          icon="devices"
          :rows="related.agents"
          empty-text="No agents have this policy directly attached."
          name-field="hostname"
          id-field="agent_id"
          @remove="(row) => unassign('agent', row)"
        />
      </section>

      <q-separator />

      <!-- ── Exclusions ─── -->
      <section class="sec__group">
        <header class="sec__group-head">
          <h3 class="sec__group-title">Exclusions</h3>
          <p class="sec__group-sub">
            Targets the policy applies to via inheritance but should be
            skipped. Useful for opting a single workstation or site out
            of an enforced parent policy.
          </p>
        </header>

        <ExclusionList
          label="Excluded clients"
          icon="business"
          :ids="excludedClients"
          :catalog="clientCatalog"
          @add="(id) => updateExclusion('clients', [...excludedClients.map(c => c.id ?? c.pk ?? c), id])"
          @remove="(id) => updateExclusion('clients', excludedClients.map(c => c.id ?? c.pk ?? c).filter((x) => x !== id))"
        />
        <ExclusionList
          label="Excluded sites"
          icon="place"
          :ids="excludedSites"
          :catalog="siteCatalog"
          @add="(id) => updateExclusion('sites', [...excludedSites.map(c => c.id ?? c.pk ?? c), id])"
          @remove="(id) => updateExclusion('sites', excludedSites.map(c => c.id ?? c.pk ?? c).filter((x) => x !== id))"
        />
        <ExclusionList
          label="Excluded agents"
          icon="devices"
          :ids="excludedAgents"
          :catalog="agentCatalog"
          name-key="hostname"
          id-key="pk"
          @add="(id) => updateExclusion('agents', [...excludedAgents.map(c => c.id ?? c.pk ?? c), id])"
          @remove="(id) => updateExclusion('agents', excludedAgents.map(c => c.id ?? c.pk ?? c).filter((x) => x !== id))"
        />
      </section>

      <PolicyAssignPicker
        v-model="pickerOpen"
        :policy-id="policyId"
        :policy-name="policyName"
        :clients="clientCatalog"
        :sites="siteCatalog"
        :agents="agentCatalog"
        @assigned="onAssigned"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import {
  fetchPolicyRelated,
  updatePolicy,
} from "@/api/automation";
import { fetchClients, editClient, fetchSites, editSite } from "@/api/clients";
import { fetchAgents, editAgent } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";

import AssignmentBucket  from "./AssignmentBucket.vue";
import ExclusionList     from "./ExclusionList.vue";
import PolicyAssignPicker from "./PolicyAssignPicker.vue";

const props = defineProps({
  policyId:        { type: Number, required: true },
  policyName:      { type: String, default: "" },
  excludedClients: { type: Array,  default: () => [] },
  excludedSites:   { type: Array,  default: () => [] },
  excludedAgents:  { type: Array,  default: () => [] },
});
const emit = defineEmits(["reload"]);

const $q = useQuasar();

const related   = ref(null);
const loading   = ref(false);
const errorMsg  = ref("");
const pickerOpen = ref(false);

// catalogs for picker + exclusion list
const clientCatalog = ref([]);
const siteCatalog   = ref([]);
const agentCatalog  = ref([]);

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const [rel, cls, sts, ags] = await Promise.all([
      fetchPolicyRelated(props.policyId),
      fetchClients(),
      fetchSites(),
      fetchAgents({ detail: false }),
    ]);
    related.value      = rel;
    clientCatalog.value = (cls || []).map((c) => ({ id: c.id ?? c.pk, pk: c.id ?? c.pk, name: c.name }));
    siteCatalog.value   = (sts || []).map((s) => ({ id: s.id ?? s.pk, pk: s.id ?? s.pk, name: `${s.client_name ? s.client_name + " · " : ""}${s.name}`, raw: s }));
    agentCatalog.value  = (ags || []).map((a) => ({ id: a.pk ?? a.id, pk: a.pk ?? a.id, agent_id: a.agent_id, hostname: a.hostname, name: a.hostname }));
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load assignments";
  }
  loading.value = false;
}

onMounted(reload);
watch(() => props.policyId, reload);

async function unassign(kind, row) {
  // kind: "client_workstation" | "client_server" | "site_workstation" | "site_server" | "agent"
  $q.dialog({
    title: "Remove assignment?",
    message: `Unassign ${row.name || row.hostname} from this policy?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      if (kind === "client_workstation") await editClient(row.id ?? row.pk, { workstation_policy: null });
      if (kind === "client_server")      await editClient(row.id ?? row.pk, { server_policy: null });
      if (kind === "site_workstation")   await editSite(row.id ?? row.pk, { workstation_policy: null });
      if (kind === "site_server")        await editSite(row.id ?? row.pk, { server_policy: null });
      if (kind === "agent")              await editAgent(row.agent_id, { policy: null });
      notifySuccess("Unassigned");
      await reload();
      emit("reload");
    } catch (e) {
      notifyError(e?.response?.data?.detail || e?.message || "Unassign failed");
    }
  });
}

async function updateExclusion(kind, ids) {
  try {
    const payload = {};
    payload[`excluded_${kind}`] = ids;
    await updatePolicy(props.policyId, payload);
    notifySuccess("Exclusions updated");
    emit("reload");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Update failed");
  }
}

async function onAssigned() {
  pickerOpen.value = false;
  await reload();
  emit("reload");
}
</script>

<style lang="scss" scoped>
.sec {
  display: flex;
  flex-direction: column;
  gap: 18px;

  &__hint {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    strong { color: inherit; }
  }

  &__state {
    padding: 24px 16px;
    color: var(--color-fg-secondary);
    text-align: center;
    background: var(--color-bg-surface);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;

    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  &__group-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  &__group-title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
  }
  &__group-sub {
    font-size: 13px;
    color: var(--color-fg-secondary);
    margin: 4px 0 0 0;
    max-width: 720px;
  }
}
</style>
