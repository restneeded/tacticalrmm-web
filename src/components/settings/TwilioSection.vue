<!--
  Phase T2 — Twilio / SMS.
-->
<template>
  <SettingsCard
    title="Twilio / SMS"
    lede="Outbound SMS via Twilio. Auth token is stored encrypted and never
          echoed back."
  >
    <template v-if="core.settings">
      <q-input
        outlined dense
        v-model="form.twilio_account_sid"
        label="Account SID"
        :readonly="!canEdit"
      />
      <q-input
        outlined dense
        v-model="form.twilio_auth_token"
        :type="showTok ? 'text' : 'password'"
        label="Auth token"
        :hint="hasToken ? 'Stored — leave unchanged to keep current token' : 'No token set'"
        :readonly="!canEdit"
      >
        <template #append>
          <q-btn flat dense round size="sm" :icon="showTok ? 'visibility_off' : 'visibility'" @click="showTok = !showTok" />
        </template>
      </q-input>
      <q-input
        outlined dense
        v-model="form.twilio_number"
        label="From number (E.164)"
        :readonly="!canEdit"
      />

      <q-separator class="tw__sep" />
      <div class="tw__sub">Default SMS recipients</div>
      <RecipientsEditor
        v-model="form.sms_alert_recipients"
        placeholder="add E.164 number + Enter"
        :readonly="!canEdit"
      />
    </template>

    <template #footer>
      <span v-if="dirty" class="tw__dirty">Unsaved changes</span>
      <q-btn
        flat no-caps
        label="Send test SMS"
        icon="sms"
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
import { sendTestSMS } from "@/api/core";
import { notifySuccess, notifyError } from "@/utils/notify";

const core = useCoreSettingsStore();
const perms = useCurrentUserPermsStore();
const canEdit = computed(
  () => perms.perms.is_superuser || perms.perms.can_edit_core_settings,
);

const form = reactive({
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_number: "",
  sms_alert_recipients: [] as string[],
});
const showTok = ref(false);
const testing = ref(false);
const hasToken = computed(
  () => !!(core.settings && core.settings.twilio_auth_token),
);

function hydrate() {
  if (!core.settings) return;
  form.twilio_account_sid = core.settings.twilio_account_sid ?? "";
  form.twilio_auth_token = core.settings.twilio_auth_token ?? "";
  form.twilio_number = core.settings.twilio_number ?? "";
  form.sms_alert_recipients = [...(core.settings.sms_alert_recipients ?? [])];
}
onMounted(async () => {
  if (!core.settings) await core.load();
  hydrate();
});
watch(() => core.settings, hydrate);

const dirty = computed(() => {
  if (!core.settings) return false;
  return (
    form.twilio_account_sid !== (core.settings.twilio_account_sid ?? "") ||
    form.twilio_auth_token !== (core.settings.twilio_auth_token ?? "") ||
    form.twilio_number !== (core.settings.twilio_number ?? "") ||
    JSON.stringify(form.sms_alert_recipients) !==
      JSON.stringify(core.settings.sms_alert_recipients ?? [])
  );
});

async function save() {
  try {
    await core.save({
      twilio_account_sid: form.twilio_account_sid,
      twilio_auth_token: form.twilio_auth_token,
      twilio_number: form.twilio_number,
      sms_alert_recipients: form.sms_alert_recipients,
    });
    notifySuccess("Twilio settings saved");
  } catch (e) {
    notifyError((e as { message?: string }).message ?? "Save failed");
  }
}
function reset() { hydrate(); }

async function onSendTest() {
  testing.value = true;
  try {
    const r = await sendTestSMS();
    notifySuccess(typeof r === "string" ? r : "SMS test sent");
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
.tw__sep { margin: 6px 0; }
.tw__sub {
  font-weight: var(--intune-font-weight-medium);
  color: var(--color-fg-primary);
}
.tw__dirty {
  font-size: var(--intune-font-size-100);
  color: var(--color-fg-tertiary);
  margin-right: auto;
}
</style>
