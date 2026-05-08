<!--
  Phase T2 — Default install / inheritance policies.

  Sets the tenant-default Server and Workstation policies on CoreSettings
  (server_policy / workstation_policy FKs). Per the Phase O inheritance
  model: Agent > Site > Client > Default(CoreSettings).
-->
<template>
  <SettingsCard
    title="Install policy"
    lede="Default Server and Workstation policies. Used when an agent's
          Client / Site doesn't override them."
  >
    <template v-if="core.settings">
      <q-select
        outlined dense
        v-model="form.server_policy"
        :options="policyOptions"
        map-options emit-value
        clearable
        label="Default server policy"
        :readonly="!canEdit"
      />
      <q-select
        outlined dense
        v-model="form.workstation_policy"
        :options="policyOptions"
        map-options emit-value
        clearable
        label="Default workstation policy"
        :readonly="!canEdit"
      />
    </template>

    <template #footer>
      <span v-if="dirty" class="ip__dirty">Unsaved changes</span>
      <q-btn flat no-caps label="Reset" :disable="!dirty" @click="reset" />
      <q-btn
        unelevated color="primary" no-caps label="Save"
        :loading="core.saving"
        :disable="!dirty || !canEdit"
        @click="save"
      />
    </template>
  </SettingsCard>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";

import SettingsCard from "@/components/settings/SettingsCard.vue";
import { useCoreSettingsStore } from "@/stores/coreSettings";
import { useCurrentUserPermsStore } from "@/stores/permissions";
import { fetchPolicies } from "@/api/automation";
import { notifySuccess, notifyError } from "@/utils/notify";

const core = useCoreSettingsStore();
const perms = useCurrentUserPermsStore();
const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

interface PolicyRow { id: number; name: string }
const policies = ref<PolicyRow[]>([]);
const policyOptions = computed(() =>
  policies.value.map((p) => ({ value: p.id, label: p.name })),
);

const form = reactive({
  server_policy: null as number | null,
  workstation_policy: null as number | null,
});

function hydrate() {
  if (!core.settings) return;
  form.server_policy = core.settings.server_policy ?? null;
  form.workstation_policy = core.settings.workstation_policy ?? null;
}

onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
  try {
    policies.value = (await fetchPolicies()) as PolicyRow[];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[install-policy] load policies failed", e);
  }
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.server_policy !== (core.settings.server_policy ?? null) ||
    form.workstation_policy !== (core.settings.workstation_policy ?? null)
  );
});

async function save() {
  try {
    await core.save({
      server_policy: form.server_policy,
      workstation_policy: form.workstation_policy,
    });
    notifySuccess("Default policies saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}
function reset() { hydrate(); }
</script>

<style lang="scss" scoped>
.ip__dirty {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
