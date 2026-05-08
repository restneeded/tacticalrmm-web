<!--
  Phase T2 — Default alert template + global notification toggles.
-->
<template>
  <SettingsCard
    title="Alert defaults"
    lede="Tenant-default alert template plus the toggles for which severities
          generate notifications."
  >
    <template v-if="core.settings">
      <q-select
        outlined dense
        v-model="form.alert_template"
        :options="templateOptions"
        map-options emit-value
        clearable
        label="Default alert template"
        :readonly="!canEdit"
      />
      <q-toggle
        v-model="form.notify_on_info_alerts"
        label="Notify on info alerts"
        :disable="!canEdit"
      />
      <q-toggle
        v-model="form.notify_on_warning_alerts"
        label="Notify on warning alerts"
        :disable="!canEdit"
      />
    </template>

    <template #footer>
      <span v-if="dirty" class="ad__dirty">Unsaved changes</span>
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
import { fetchAlertTemplates } from "@/api/alerts";
import { notifySuccess, notifyError } from "@/utils/notify";

const core = useCoreSettingsStore();
const perms = useCurrentUserPermsStore();
const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

interface TemplateRow { id: number; name: string }
const templates = ref<TemplateRow[]>([]);
const templateOptions = computed(() =>
  templates.value.map((t) => ({ value: t.id, label: t.name })),
);

const form = reactive({
  alert_template: null as number | null,
  notify_on_info_alerts: false,
  notify_on_warning_alerts: true,
});

function hydrate() {
  if (!core.settings) return;
  form.alert_template = core.settings.alert_template ?? null;
  form.notify_on_info_alerts = core.settings.notify_on_info_alerts ?? false;
  form.notify_on_warning_alerts = core.settings.notify_on_warning_alerts ?? true;
}

onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
  try {
    templates.value = (await fetchAlertTemplates()) as TemplateRow[];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[alert-defaults] load templates failed", e);
  }
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.alert_template !== (core.settings.alert_template ?? null) ||
    form.notify_on_info_alerts !== (core.settings.notify_on_info_alerts ?? false) ||
    form.notify_on_warning_alerts !== (core.settings.notify_on_warning_alerts ?? true)
  );
});

async function save() {
  try {
    await core.save({
      alert_template: form.alert_template,
      notify_on_info_alerts: form.notify_on_info_alerts,
      notify_on_warning_alerts: form.notify_on_warning_alerts,
    });
    notifySuccess("Alert defaults saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}
function reset() { hydrate(); }
</script>

<style lang="scss" scoped>
.ad__dirty {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
