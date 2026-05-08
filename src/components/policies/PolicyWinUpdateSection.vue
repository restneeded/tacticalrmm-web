<!--
  PolicyWinUpdateSection — embedded WinUpdatePolicy editor for /policies/:id.

  Backend (api/tacticalrmm/automation/views.py UpdatePatchPolicy):
    POST /automation/patchpolicy/        { policy: <pid>, ...fields }   — create
    PUT  /automation/patchpolicy/<pk>/   { ...partial }                  — update

  PolicySerializer ships winupdatepolicy[] (a list) on the policy doc;
  there's exactly one row per policy in practice.

  Field shape (winupdate/models.py WinUpdatePolicy):
    critical / important / moderate / low / other  →  one of
        manual | approve | ignore | inherit
    run_time_hour                                  →  0..23
    run_time_frequency                             →  daily | monthly | inherit
    run_time_days (array of weekday ints 0..6)     →  for daily/weekly
    run_time_day                                   →  1..31 (monthly)
    reboot_after_install                           →  never | required | always | inherit
    reprocess_failed_inherit (bool)
    reprocess_failed (bool) + reprocess_failed_times (int)
    email_if_fail (bool)
-->
<template>
  <div class="wu">
    <div v-if="loading" class="wu__state">Loading Windows-update settings…</div>
    <div v-else-if="errorMsg" class="wu__state wu__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <template v-else>
      <header class="wu__head">
        <h3 class="wu__title">Windows Update settings</h3>
        <p class="wu__sub">
          How agents bound to this policy should approve, schedule, and
          reboot for Windows updates. Anything left as <em>Inherit</em>
          falls through to the parent policy or core settings.
        </p>
        <p class="wu__sub">
          <RouterLink class="wu__link" :to="{ name: 'Patching' }">
            Manage fleet patches in /patching →
          </RouterLink>
        </p>
      </header>

      <section class="wu__group">
        <h4 class="wu__group-title">Auto-approval by severity</h4>
        <div class="wu__grid">
          <q-select
            v-for="sev in SEVERITIES" :key="sev.field"
            v-model="form[sev.field]"
            :options="APPROVAL_OPTIONS"
            map-options emit-value
            outlined dense
            :label="sev.label"
          />
        </div>
      </section>

      <section class="wu__group">
        <h4 class="wu__group-title">Schedule</h4>
        <div class="wu__grid wu__grid--cols3">
          <q-select
            v-model="form.run_time_frequency"
            :options="FREQ_OPTIONS"
            map-options emit-value
            outlined dense
            label="Frequency"
          />
          <q-select
            v-model.number="form.run_time_hour"
            :options="HOUR_OPTIONS"
            map-options emit-value
            outlined dense
            label="Run time"
          />
          <q-select
            v-if="form.run_time_frequency === 'monthly'"
            v-model.number="form.run_time_day"
            :options="DAY_OPTIONS"
            map-options emit-value
            outlined dense
            label="Day of month"
          />
          <q-option-group
            v-else
            v-model="form.run_time_days"
            :options="WEEKDAY_OPTIONS"
            type="checkbox"
            inline
            class="wu__weekdays"
          />
        </div>
      </section>

      <section class="wu__group">
        <h4 class="wu__group-title">Reboot &amp; retry</h4>
        <div class="wu__grid wu__grid--cols2">
          <q-select
            v-model="form.reboot_after_install"
            :options="REBOOT_OPTIONS"
            map-options emit-value
            outlined dense
            label="Reboot after install"
          />
          <div class="wu__toggles">
            <q-toggle v-model="form.reprocess_failed_inherit" label="Inherit retry behavior" />
            <q-toggle
              v-model="form.reprocess_failed"
              :disable="form.reprocess_failed_inherit"
              label="Retry failed updates"
            />
            <q-input
              v-model.number="form.reprocess_failed_times"
              type="number" min="1" max="20"
              outlined dense
              label="Retry attempts"
              :disable="!form.reprocess_failed || form.reprocess_failed_inherit"
              class="wu__retry-count"
            />
            <q-toggle v-model="form.email_if_fail" label="Email me on persistent failure" />
          </div>
        </div>
      </section>

      <footer class="wu__foot">
        <q-btn
          unelevated color="primary" no-caps
          :label="isUpdate ? 'Save settings' : 'Enable Windows Update policy'"
          :loading="saving"
          @click="onSave"
        />
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { createPatchPolicy, updatePatchPolicy } from "@/api/automation";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  policyId:          { type: Number, required: true },
  winUpdatePolicies: { type: Array,  default: () => [] },
});
const emit = defineEmits(["reload"]);

const SEVERITIES = [
  { field: "critical",  label: "Critical" },
  { field: "important", label: "Important" },
  { field: "moderate",  label: "Moderate" },
  { field: "low",       label: "Low" },
  { field: "other",     label: "Other" },
];
const APPROVAL_OPTIONS = [
  { value: "manual",  label: "Manual review" },
  { value: "approve", label: "Auto-approve" },
  { value: "ignore",  label: "Ignore" },
  { value: "inherit", label: "Inherit" },
];
const FREQ_OPTIONS = [
  { value: "daily",   label: "Daily / weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "inherit", label: "Inherit" },
];
const REBOOT_OPTIONS = [
  { value: "never",    label: "Never" },
  { value: "required", label: "When required" },
  { value: "always",   label: "Always" },
  { value: "inherit",  label: "Inherit" },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i, label: new Date(2000, 0, 1, i).toLocaleString([], { hour: "numeric", hour12: true }),
}));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const WEEKDAY_OPTIONS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

const loading  = ref(false);
const errorMsg = ref("");
const saving   = ref(false);

const form = ref(blankForm());

const isUpdate = computed(() => Array.isArray(props.winUpdatePolicies) && props.winUpdatePolicies.length > 0);

function blankForm() {
  return {
    id: null,
    critical:  "inherit",
    important: "inherit",
    moderate:  "inherit",
    low:       "inherit",
    other:     "inherit",
    run_time_hour: 3,
    run_time_frequency: "inherit",
    run_time_days: [],
    run_time_day: 1,
    reboot_after_install: "inherit",
    reprocess_failed_inherit: true,
    reprocess_failed: false,
    reprocess_failed_times: 5,
    email_if_fail: false,
  };
}

watch(() => props.winUpdatePolicies, hydrate, { immediate: true });

function hydrate() {
  const wu = props.winUpdatePolicies?.[0];
  if (!wu) {
    form.value = blankForm();
    return;
  }
  form.value = {
    id: wu.id ?? wu.pk,
    critical:  wu.critical  || "inherit",
    important: wu.important || "inherit",
    moderate:  wu.moderate  || "inherit",
    low:       wu.low       || "inherit",
    other:     wu.other     || "inherit",
    run_time_hour: wu.run_time_hour ?? 3,
    run_time_frequency: wu.run_time_frequency || "inherit",
    run_time_days: Array.isArray(wu.run_time_days) ? wu.run_time_days : [],
    run_time_day: wu.run_time_day ?? 1,
    reboot_after_install: wu.reboot_after_install || "inherit",
    reprocess_failed_inherit: wu.reprocess_failed_inherit ?? true,
    reprocess_failed: wu.reprocess_failed ?? false,
    reprocess_failed_times: wu.reprocess_failed_times ?? 5,
    email_if_fail: wu.email_if_fail ?? false,
  };
}

onMounted(hydrate);

async function onSave() {
  saving.value = true;
  try {
    const payload = { ...form.value };
    delete payload.id;
    if (isUpdate.value && form.value.id) {
      await updatePatchPolicy(form.value.id, payload);
    } else {
      payload.policy = props.policyId;
      await createPatchPolicy(payload);
    }
    notifySuccess("Windows Update settings saved");
    emit("reload");
  } catch (e) {
    errorMsg.value = "";
    notifyError(e?.response?.data?.detail || e?.message || "Save failed");
  }
  saving.value = false;
}
</script>

<style lang="scss" scoped>
.wu {
  display: flex;
  flex-direction: column;
  gap: 22px;

  &__state {
    padding: 24px 16px;
    color: var(--color-fg-secondary);
    text-align: center;
    background: var(--color-bg-surface);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__head { max-width: 720px; }
  &__link {
    color: var(--color-fg-link, #0078d4);
    text-decoration: none;
    font-size: 13px;
    &:hover { text-decoration: underline; }
  }
  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
  }
  &__sub {
    color: var(--color-fg-secondary);
    margin: 4px 0 0 0;
    font-size: 13px;
    em { font-style: italic; }
  }

  &__group {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 10px;
    padding: 14px 16px;
  }
  &__group-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 10px 0;
    color: var(--color-fg-primary);
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    &--cols3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    &--cols2 { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
    @media (max-width: 960px) {
      grid-template-columns: 1fr 1fr;
    }
  }
  &__weekdays {
    grid-column: 1 / -1;
  }
  &__toggles {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  &__retry-count {
    max-width: 180px;
  }
  &__foot {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
