<!--
  ChipsInput — Phase P chip-style multi-string input.

  Wraps a Quasar select in `use-chips` mode with create-on-enter.
  Used by AlertTemplateDetailPage for email_recipients / text_recipients.
  Trades a tiny dependency on Quasar select for a one-file solution that
  still supports paste-and-comma-split via the addOption hook.
-->
<template>
  <q-select
    :model-value="modelValue"
    use-input use-chips multiple
    new-value-mode="add-unique"
    hide-dropdown-icon
    dense outlined
    :label="label"
    :placeholder="modelValue?.length ? '' : placeholder"
    @update:model-value="onChange"
    @new-value="onNew"
    class="atd__chips"
  />
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  type: { type: String, default: "text" },
});
const emit = defineEmits(["update:modelValue", "change"]);

function onChange(v) {
  emit("update:modelValue", v ?? []);
  emit("change");
}

function onNew(val, done) {
  const trimmed = (val || "").trim();
  if (!trimmed) return done(null);
  // Split on commas/whitespace so "a@b.com, c@d.com" pastes cleanly.
  const parts = trimmed.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    done(parts[0], "add-unique");
  } else {
    // Multi: add the first via done() (Quasar contract) and let the
    // change handler emit the merged list.
    done(null);
    const merged = Array.from(new Set([...(props.modelValue || []), ...parts]));
    emit("update:modelValue", merged);
    emit("change");
  }
}
</script>

<style lang="scss" scoped>
.atd__chips { max-width: 600px; }
</style>
