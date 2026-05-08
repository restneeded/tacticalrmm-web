<!--
  PolicyHeader — Phase O policy detail page header.

  Shows + edits the trunk-level policy fields:
    - name (inline-editable)
    - desc (inline-editable, multi-line)
    - active toggle
    - enforced toggle
    - alert_template picker
    - default-server / default-workstation badges (read-only here —
      defaults are bound via CoreSettings.workstation_policy /
      server_policy and managed in Settings → Global)

  Emits a PUT-shaped patch via @update so the parent page can save.
-->
<template>
  <section class="ph">
    <div class="ph__row">
      <div class="ph__name-block">
        <q-input
          v-if="editingName"
          v-model="nameDraft"
          dense outlined autofocus
          class="ph__name-input"
          :rules="[(v) => !!(v && v.trim()) || 'Required']"
          hide-bottom-space
          @blur="commitName"
          @keyup.enter="commitName"
          @keyup.esc="cancelName"
        />
        <h1 v-else class="ph__name" @click="startEditName">
          {{ policy.name }}
          <q-icon name="edit" size="14px" class="ph__edit-ic" />
        </h1>

        <q-input
          v-if="editingDesc"
          v-model="descDraft"
          dense outlined autofocus
          autogrow
          type="textarea"
          class="ph__desc-input"
          @blur="commitDesc"
          @keyup.esc="cancelDesc"
        />
        <p v-else class="ph__desc" :class="{ 'ph__desc--empty': !policy.desc }" @click="startEditDesc">
          {{ policy.desc || "Add a description…" }}
          <q-icon name="edit" size="12px" class="ph__edit-ic" />
        </p>
      </div>

      <div class="ph__chips">
        <span v-if="policy.default_server_policy" class="chip chip--info">Default · servers</span>
        <span v-if="policy.default_workstation_policy" class="chip chip--info">Default · workstations</span>
      </div>
    </div>

    <div class="ph__controls">
      <q-toggle
        :model-value="!!policy.active"
        label="Active"
        @update:model-value="(v) => $emit('update', { active: v })"
      >
        <q-tooltip>Inactive policies don't apply to agents</q-tooltip>
      </q-toggle>
      <q-toggle
        :model-value="!!policy.enforced"
        label="Enforced"
        @update:model-value="(v) => $emit('update', { enforced: v })"
      >
        <q-tooltip>Enforced policies override agent-specific overrides</q-tooltip>
      </q-toggle>

      <div class="ph__alert">
        <span class="ph__alert-label">Alert template</span>
        <q-select
          :model-value="policy.alert_template ?? null"
          :options="alertTemplateOptions"
          map-options emit-value
          dense outlined options-dense
          clearable
          class="ph__alert-select"
          :loading="loadingAlerts"
          placeholder="None"
          @update:model-value="(v) => $emit('update', { alert_template: v })"
        />
      </div>

      <q-space />
      <q-btn
        v-if="saving"
        flat dense no-caps
        icon="hourglass_empty" label="Saving…"
        class="ph__saving"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchAlertTemplates } from "@/api/alerts";

const props = defineProps({
  policy: { type: Object, required: true },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(["update"]);

const editingName = ref(false);
const nameDraft   = ref("");
const editingDesc = ref(false);
const descDraft   = ref("");

function startEditName() {
  nameDraft.value = props.policy.name || "";
  editingName.value = true;
}
function commitName() {
  if (!editingName.value) return;
  const v = nameDraft.value.trim();
  if (v && v !== props.policy.name) emit("update", { name: v });
  editingName.value = false;
}
function cancelName() { editingName.value = false; }

function startEditDesc() {
  descDraft.value = props.policy.desc || "";
  editingDesc.value = true;
}
function commitDesc() {
  if (!editingDesc.value) return;
  const v = descDraft.value.trim();
  if (v !== (props.policy.desc || "")) emit("update", { desc: v });
  editingDesc.value = false;
}
function cancelDesc() { editingDesc.value = false; }

// ─── alert templates ──────────────────────────────────────────────────
const alertTemplates = ref([]);
const loadingAlerts  = ref(false);
const alertTemplateOptions = computed(() =>
  alertTemplates.value.map((t) => ({ value: t.id ?? t.pk, label: t.name }))
);

onMounted(async () => {
  loadingAlerts.value = true;
  try {
    const data = await fetchAlertTemplates();
    alertTemplates.value = Array.isArray(data) ? data : [];
  } catch {
    // alert templates feature gated on permissions — silent fallback.
    alertTemplates.value = [];
  }
  loadingAlerts.value = false;
});
</script>

<style lang="scss" scoped>
.ph {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 18px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 10px;

  &__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  &__name-block { min-width: 0; flex: 1 1 auto; }
  &__name {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.15;
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
    cursor: pointer;
    .ph__edit-ic {
      opacity: 0;
      margin-left: 6px;
      transition: opacity 80ms ease;
    }
    &:hover .ph__edit-ic { opacity: 1; }
  }
  &__name-input {
    margin: -4px 0 6px 0;
    :deep(.q-field__control) { font-size: var(--intune-font-size-700); }
  }
  &__desc {
    margin: 0;
    color: var(--color-fg-secondary);
    cursor: pointer;
    max-width: 720px;
    .ph__edit-ic {
      opacity: 0;
      margin-left: 4px;
      transition: opacity 80ms ease;
    }
    &:hover .ph__edit-ic { opacity: 1; }
    &--empty { font-style: italic; color: var(--color-fg-tertiary); }
  }
  &__desc-input { max-width: 720px; }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: flex-start;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  &__alert {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  &__alert-label {
    color: var(--color-fg-secondary);
    font-size: 13px;
  }
  &__alert-select { min-width: 220px; }
  &__saving {
    color: var(--color-fg-secondary);
    font-size: 12px;
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);
  border: 1px solid var(--color-border-subtle);

  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
}
</style>
