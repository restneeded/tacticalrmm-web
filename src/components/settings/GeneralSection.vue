<!--
  Phase T2 — General settings.
  Default timezone, date format, agent auto-update toggle.
-->
<template>
  <SettingsCard
    title="General"
    lede="Tenant-wide defaults that affect every signed-in user."
  >
    <q-banner v-if="!core.settings && core.loading" dense rounded>
      Loading…
    </q-banner>

    <template v-if="core.settings">
      <q-select
        outlined
        dense
        v-model="form.default_time_zone"
        :options="core.settings.all_timezones"
        label="Default timezone"
        :readonly="!canEdit"
      />

      <q-input
        outlined
        dense
        v-model="form.date_format"
        label="Default date format"
        hint="e.g. MMM-DD-YYYY - HH:mm"
        :readonly="!canEdit"
      />

      <q-toggle
        v-model="form.agent_auto_update"
        label="Auto-update agents on new releases"
        :disable="!canEdit"
      />
    </template>

    <template #footer>
      <span v-if="dirty" class="general__dirty">Unsaved changes</span>
      <q-btn flat no-caps label="Reset" :disable="!dirty" @click="reset" />
      <q-btn
        unelevated
        color="primary"
        no-caps
        label="Save"
        :loading="core.saving"
        :disable="!dirty || !canEdit"
        @click="save"
      />
    </template>
  </SettingsCard>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";

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
  default_time_zone: "",
  date_format: "",
  agent_auto_update: true,
});

function hydrate() {
  if (!core.settings) return;
  form.default_time_zone = core.settings.default_time_zone ?? "";
  form.date_format = core.settings.date_format ?? "";
  form.agent_auto_update = core.settings.agent_auto_update ?? true;
}

onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.default_time_zone !== (core.settings.default_time_zone ?? "") ||
    form.date_format !== (core.settings.date_format ?? "") ||
    form.agent_auto_update !== (core.settings.agent_auto_update ?? true)
  );
});

async function save() {
  try {
    await core.save({
      default_time_zone: form.default_time_zone,
      date_format: form.date_format,
      agent_auto_update: form.agent_auto_update,
    });
    notifySuccess("General settings saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}

function reset() {
  hydrate();
}
</script>

<style lang="scss" scoped>
.general__dirty {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
