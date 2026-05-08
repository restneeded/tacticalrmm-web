<!--
  Phase T2 — SMTP / Email.
  Outbound mail credentials, default recipients, "Send test email".
-->
<template>
  <SettingsCard
    title="SMTP / Email"
    lede="Outbound email used by alerts and notifications. The password is
          stored encrypted in the database and never echoed back."
  >
    <template v-if="core.settings">
      <q-input
        outlined dense
        v-model="form.smtp_host"
        label="SMTP host"
        :readonly="!canEdit"
      />
      <q-input
        outlined dense
        v-model.number="form.smtp_port"
        type="number"
        label="SMTP port"
        :readonly="!canEdit"
      />
      <q-toggle
        v-model="form.smtp_requires_auth"
        label="Server requires authentication (TLS/login)"
        :disable="!canEdit"
      />
      <q-input
        outlined dense
        v-model="form.smtp_host_user"
        label="SMTP username"
        :readonly="!canEdit"
        :disable="!form.smtp_requires_auth"
      />
      <q-input
        outlined dense
        v-model="form.smtp_host_password"
        :type="showPw ? 'text' : 'password'"
        label="SMTP password"
        :hint="hasPassword ? 'Stored — leave unchanged to keep current password' : 'No password set'"
        :readonly="!canEdit"
        :disable="!form.smtp_requires_auth"
      >
        <template #append>
          <q-btn flat dense round size="sm" :icon="showPw ? 'visibility_off' : 'visibility'" @click="showPw = !showPw" />
        </template>
      </q-input>
      <q-input
        outlined dense
        v-model="form.smtp_from_email"
        label="From email"
        :readonly="!canEdit"
      />
      <q-input
        outlined dense
        v-model="form.smtp_from_name"
        label="From name (optional)"
        :readonly="!canEdit"
      />

      <q-separator class="smtp__sep" />
      <div class="smtp__sub">Default email recipients</div>
      <RecipientsEditor
        v-model="form.email_alert_recipients"
        placeholder="add email + Enter"
        type="email"
        :readonly="!canEdit"
      />
    </template>

    <template #footer>
      <span v-if="dirty" class="smtp__dirty">Unsaved changes</span>
      <q-btn
        flat no-caps
        label="Send test email"
        icon="forward_to_inbox"
        :disable="dirty || !canEdit"
        :loading="testing"
        @click="onSendTest"
      >
        <q-tooltip v-if="dirty">Save first to test with the new settings.</q-tooltip>
      </q-btn>
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
import RecipientsEditor from "@/components/settings/RecipientsEditor.vue";
import { useCoreSettingsStore } from "@/stores/coreSettings";
import { useCurrentUserPermsStore } from "@/stores/permissions";
import { sendTestEmail } from "@/api/core";
import { notifySuccess, notifyError } from "@/utils/notify";

const core = useCoreSettingsStore();
const perms = useCurrentUserPermsStore();
const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

const form = reactive({
  smtp_host: "",
  smtp_port: 587,
  smtp_requires_auth: true,
  smtp_host_user: "",
  smtp_host_password: "",
  smtp_from_email: "",
  smtp_from_name: "",
  email_alert_recipients: [] as string[],
});

const showPw = ref(false);
const testing = ref(false);
const hasPassword = computed(
  () => !!(core.settings && core.settings.smtp_host_password),
);

function hydrate() {
  if (!core.settings) return;
  form.smtp_host = core.settings.smtp_host ?? "";
  form.smtp_port = core.settings.smtp_port ?? 587;
  form.smtp_requires_auth = core.settings.smtp_requires_auth ?? true;
  form.smtp_host_user = core.settings.smtp_host_user ?? "";
  form.smtp_host_password = core.settings.smtp_host_password ?? "";
  form.smtp_from_email = core.settings.smtp_from_email ?? "";
  form.smtp_from_name = core.settings.smtp_from_name ?? "";
  form.email_alert_recipients = [...(core.settings.email_alert_recipients ?? [])];
}

onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.smtp_host !== (core.settings.smtp_host ?? "") ||
    form.smtp_port !== (core.settings.smtp_port ?? 587) ||
    form.smtp_requires_auth !== (core.settings.smtp_requires_auth ?? true) ||
    form.smtp_host_user !== (core.settings.smtp_host_user ?? "") ||
    form.smtp_host_password !== (core.settings.smtp_host_password ?? "") ||
    form.smtp_from_email !== (core.settings.smtp_from_email ?? "") ||
    form.smtp_from_name !== (core.settings.smtp_from_name ?? "") ||
    JSON.stringify(form.email_alert_recipients) !==
      JSON.stringify(core.settings.email_alert_recipients ?? [])
  );
});

async function save() {
  try {
    await core.save({
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_requires_auth: form.smtp_requires_auth,
      smtp_host_user: form.smtp_host_user,
      smtp_host_password: form.smtp_host_password,
      smtp_from_email: form.smtp_from_email,
      smtp_from_name: form.smtp_from_name,
      email_alert_recipients: form.email_alert_recipients,
    });
    notifySuccess("SMTP settings saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}
function reset() { hydrate(); }

async function onSendTest() {
  testing.value = true;
  try {
    const r = await sendTestEmail();
    notifySuccess(typeof r === "string" ? r : "Email test sent");
  } catch (e) {
    const msg =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e as any)?.response?.data ?? (e as { message?: string }).message ?? "Test failed";
    notifyError(typeof msg === "string" ? msg : "Test failed");
  } finally {
    testing.value = false;
  }
}
</script>

<style lang="scss" scoped>
.smtp__sep { margin: 6px 0; }
.smtp__sub {
  font-weight: var(--intune-font-weight-medium);
  color: var(--color-fg-primary);
}
.smtp__dirty {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
