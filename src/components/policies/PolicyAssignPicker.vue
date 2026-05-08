<!--
  PolicyAssignPicker — modal for binding the current policy to one
  Client / Site / Agent. The user picks:
    1. Target type (client / site / agent)
    2. The specific target
    3. For clients/sites: which slot (workstation / server)
       For agents: just the FK (a single Agent.policy field).

  Writes happen via the target's existing PUT endpoint:
    PUT /clients/<id>/   { workstation_policy: <pid> }   or { server_policy: <pid> }
    PUT /clients/sites/<id>/  { workstation_policy: <pid> } or { server_policy: <pid> }
    PUT /agents/<agent_id>/  { policy: <pid> }
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
  >
    <q-card class="ap" style="min-width: 460px;">
      <q-card-section class="ap__head">
        <div class="ap__title">Assign “{{ policyName }}”</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="ap__body">
        <div class="ap__row">
          <span class="ap__label">Target type</span>
          <q-btn-toggle
            v-model="kind"
            :options="[
              { value: 'client', label: 'Client', icon: 'business' },
              { value: 'site',   label: 'Site',   icon: 'place' },
              { value: 'agent',  label: 'Agent',  icon: 'devices' },
            ]"
            outline no-caps dense
          />
        </div>

        <q-select
          v-model="targetId"
          :options="targetOptions"
          map-options emit-value
          outlined dense use-input
          input-debounce="100"
          :label="`Pick a ${kind}`"
          @filter="onFilter"
        />

        <div v-if="kind !== 'agent'" class="ap__row">
          <span class="ap__label">Slot</span>
          <q-btn-toggle
            v-model="slot"
            :options="[
              { value: 'workstation_policy', label: 'Workstation' },
              { value: 'server_policy',      label: 'Server' },
            ]"
            outline no-caps dense
          />
          <p class="ap__hint">
            Clients and Sites have separate workstation and server policy slots.
            Agents inherit whichever matches their monitoring type.
          </p>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="ap__foot">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn
          unelevated color="primary" no-caps label="Assign"
          :loading="saving"
          :disable="!canSubmit"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { editClient, editSite } from "@/api/clients";
import { editAgent } from "@/api/agents";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  policyId:   { type: Number, required: true },
  policyName: { type: String, default: "" },
  clients:    { type: Array, default: () => [] },
  sites:      { type: Array, default: () => [] },
  agents:     { type: Array, default: () => [] },
});
const emit = defineEmits(["update:modelValue", "assigned"]);

const kind     = ref("client");
const slot     = ref("workstation_policy");
const targetId = ref(null);
const filterQ  = ref("");
const saving   = ref(false);

watch(() => props.modelValue, (v) => {
  if (v) {
    kind.value = "client"; slot.value = "workstation_policy";
    targetId.value = null; filterQ.value = "";
  }
});
watch(kind, () => { targetId.value = null; });

const targetOptions = computed(() => {
  const q = filterQ.value.trim().toLowerCase();
  let src = [];
  if (kind.value === "client") src = props.clients;
  if (kind.value === "site")   src = props.sites;
  if (kind.value === "agent")  src = props.agents;
  return src
    .filter((x) => !q || (x.name || x.hostname || "").toLowerCase().includes(q))
    .map((x) => ({
      value: kind.value === "agent" ? x.agent_id : (x.id ?? x.pk),
      label: x.name || x.hostname,
    }));
});

function onFilter(val, update) {
  update(() => { filterQ.value = val || ""; });
}

const canSubmit = computed(() => targetId.value != null);

async function onSubmit() {
  if (!canSubmit.value) return;
  saving.value = true;
  try {
    if (kind.value === "client") {
      const payload = {}; payload[slot.value] = props.policyId;
      await editClient(targetId.value, payload);
    } else if (kind.value === "site") {
      const payload = {}; payload[slot.value] = props.policyId;
      await editSite(targetId.value, payload);
    } else {
      await editAgent(targetId.value, { policy: props.policyId });
    }
    notifySuccess("Assigned");
    emit("assigned");
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Assignment failed");
  }
  saving.value = false;
}
</script>

<style lang="scss" scoped>
.ap {
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  &__label {
    font-size: 13px;
    color: var(--color-fg-secondary);
    min-width: 90px;
  }
  &__hint {
    flex-basis: 100%;
    font-size: 12px;
    color: var(--color-fg-tertiary);
    margin: 0;
  }
  &__foot { padding: 10px 16px; }
}
</style>
