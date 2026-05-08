<!--
  PolicyAddDialog — Phase O — minimal "create policy" prompt.

  We deliberately keep this lean: only Name + Description + Active flag.
  Once the user lands on /policies/:id they can configure everything else
  (alert template, win update, exclusions, checks, tasks, assignments).

  Backend: POST /automation/policies/  with { name, desc, active, enforced }.
  The serializer doesn't return the new pk in the response body (the view
  returns just "ok"), so we re-fetch the list and find the new row by name.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
  >
    <q-card class="pad" style="min-width: 420px;">
      <q-card-section class="pad__head">
        <div class="pad__title">New policy</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="pad__body">
        <q-input
          v-model="form.name"
          outlined dense autofocus
          label="Name *"
          :rules="[(v) => (v && v.trim()) || 'Required']"
          hide-bottom-space
        />
        <q-input
          v-model="form.desc"
          outlined dense type="textarea"
          autogrow rows="2"
          label="Description"
          class="pad__field"
        />
        <div class="pad__row">
          <q-toggle v-model="form.active"   label="Active when saved" />
          <q-toggle v-model="form.enforced" label="Enforced" />
        </div>
        <p class="pad__hint">
          Inactive policies don't apply to agents. You can change this and
          everything else after the policy is created.
        </p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="pad__foot">
        <q-btn flat no-caps label="Cancel" v-close-popup />
        <q-btn
          unelevated color="primary"
          :loading="saving"
          :disable="!canSave"
          no-caps label="Create"
          @click="onCreate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { createPolicy, fetchPolicies } from "@/api/automation";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "saved"]);

const blank = () => ({ name: "", desc: "", active: false, enforced: false });
const form  = ref(blank());
const saving = ref(false);

watch(() => props.modelValue, (v) => { if (v) form.value = blank(); });

const canSave = computed(() => !!form.value.name.trim());

async function onCreate() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    await createPolicy({
      name: form.value.name.trim(),
      desc: form.value.desc?.trim() || "",
      active: !!form.value.active,
      enforced: !!form.value.enforced,
    });
    // backend doesn't return the new pk; re-list and find by name.
    const all = await fetchPolicies();
    const match = (all || []).find((p) => p.name === form.value.name.trim());
    notifySuccess("Policy created");
    emit("saved", match?.id ?? match?.pk ?? null);
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.response?.data?.name?.[0] || e?.message || "Create failed");
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.pad {
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  &__field {
    margin-top: 4px;
  }
  &__row {
    display: flex;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
  }
  &__hint {
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin: 4px 0 0 0;
  }
  &__foot {
    padding: 12px 16px;
  }
}
</style>
