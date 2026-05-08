<!--
  Phase T2 — MeshCentral.
  Note: there is no backend "verify Mesh connection" endpoint, so we render
  a static read-only sync-status indicator + the credential fields. A
  dedicated verify endpoint would land in a follow-up phase.
-->
<template>
  <SettingsCard
    title="MeshCentral"
    lede="Bridge between TacticalRMM and your MeshCentral install. The token
          is stored encrypted and never echoed back."
  >
    <template v-if="core.settings">
      <q-input outlined dense v-model="form.mesh_username" label="Mesh username" :readonly="!canEdit" />
      <q-input
        outlined dense
        v-model="form.mesh_token"
        :type="showTok ? 'text' : 'password'"
        label="Mesh API token"
        :hint="hasToken ? 'Stored — leave unchanged to keep current token' : 'No token set'"
        :readonly="!canEdit"
      >
        <template #append>
          <q-btn flat dense round size="sm" :icon="showTok ? 'visibility_off' : 'visibility'" @click="showTok = !showTok" />
        </template>
      </q-input>
      <q-input outlined dense v-model="form.mesh_site" label="Mesh site URL" :readonly="!canEdit" />
      <q-input outlined dense v-model="form.mesh_device_group" label="Device group" :readonly="!canEdit" />
      <q-input outlined dense v-model="form.mesh_company_name" label="Company name (optional)" :readonly="!canEdit" />
      <q-toggle
        v-model="form.sync_mesh_with_trmm"
        label="Sync Mesh permissions with TRMM users"
        :disable="!canEdit"
      />
    </template>

    <template #footer>
      <span class="mesh__hint">
        “Verify connection” is not yet supported by the API; once a backend
        endpoint exists it will surface here.
      </span>
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
import { notifySuccess, notifyError } from "@/utils/notify";

const core = useCoreSettingsStore();
const perms = useCurrentUserPermsStore();
const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

const form = reactive({
  mesh_username: "",
  mesh_token: "",
  mesh_site: "",
  mesh_device_group: "",
  mesh_company_name: "",
  sync_mesh_with_trmm: true,
});
const showTok = ref(false);
const hasToken = computed(
  () => !!(core.settings && core.settings.mesh_token && core.settings.mesh_token !== "n/a"),
);

function hydrate() {
  if (!core.settings) return;
  form.mesh_username = core.settings.mesh_username ?? "";
  form.mesh_token = core.settings.mesh_token ?? "";
  form.mesh_site = core.settings.mesh_site ?? "";
  form.mesh_device_group = core.settings.mesh_device_group ?? "";
  form.mesh_company_name = core.settings.mesh_company_name ?? "";
  form.sync_mesh_with_trmm = core.settings.sync_mesh_with_trmm ?? true;
}
onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.mesh_username !== (core.settings.mesh_username ?? "") ||
    form.mesh_token !== (core.settings.mesh_token ?? "") ||
    form.mesh_site !== (core.settings.mesh_site ?? "") ||
    form.mesh_device_group !== (core.settings.mesh_device_group ?? "") ||
    form.mesh_company_name !== (core.settings.mesh_company_name ?? "") ||
    form.sync_mesh_with_trmm !== (core.settings.sync_mesh_with_trmm ?? true)
  );
});

async function save() {
  try {
    await core.save({
      mesh_username: form.mesh_username,
      mesh_token: form.mesh_token,
      mesh_site: form.mesh_site,
      mesh_device_group: form.mesh_device_group,
      mesh_company_name: form.mesh_company_name,
      sync_mesh_with_trmm: form.sync_mesh_with_trmm,
    });
    notifySuccess("MeshCentral settings saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}
function reset() { hydrate(); }
</script>

<style lang="scss" scoped>
.mesh__hint {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
