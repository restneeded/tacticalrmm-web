<!--
  ExclusionList — Add/remove items from one of the Policy.excluded_*
  M2M arrays. Emits @add(id) and @remove(id); the parent persists via
  PUT /automation/policies/<id>/.

  `ids` is the current excluded list (entries may be raw ids or
  serialized objects with id/pk). `catalog` is the full pickable list
  shaped { id, name, ... }.
-->
<template>
  <div class="ex">
    <header class="ex__head">
      <q-icon :name="icon" size="14px" class="ex__ic" />
      <span class="ex__label">{{ label }}</span>
      <span class="ex__count">· {{ effectiveIds.length }}</span>
      <q-space />
      <q-btn
        flat dense no-caps icon="add" label="Exclude…" size="sm"
        color="primary"
        @click="addOpen = true"
      />
    </header>

    <div v-if="effectiveIds.length === 0" class="ex__empty">
      No exclusions.
    </div>
    <ul v-else class="ex__list">
      <li v-for="id in effectiveIds" :key="id" class="ex__item">
        <span class="ex__name">{{ nameFor(id) }}</span>
        <q-btn
          flat dense round icon="close" size="xs"
          @click="$emit('remove', id)"
        >
          <q-tooltip>Remove exclusion</q-tooltip>
        </q-btn>
      </li>
    </ul>

    <q-dialog v-model="addOpen">
      <q-card style="min-width: 360px">
        <q-card-section>
          <div class="ex__title">Exclude from {{ label.toLowerCase() }}</div>
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="picked"
            :options="availableOptions"
            map-options emit-value
            outlined dense
            label="Pick a target"
            use-input
            input-debounce="100"
            @filter="onFilter"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            unelevated color="primary" no-caps label="Exclude"
            :disable="!picked"
            @click="onConfirm"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  label:    { type: String, required: true },
  icon:     { type: String, default: "block" },
  ids:      { type: Array,  default: () => [] },
  catalog:  { type: Array,  default: () => [] },
  nameKey:  { type: String, default: "name" },
  idKey:    { type: String, default: "id" },
});
const emit = defineEmits(["add", "remove"]);

const addOpen = ref(false);
const picked  = ref(null);
const filterQ = ref("");

// `ids` may be array of raw ids OR array of objects.
const effectiveIds = computed(() =>
  props.ids.map((x) => (typeof x === "object" ? (x.id ?? x.pk) : x)).filter((x) => x != null)
);

function nameFor(id) {
  const hit = props.catalog.find((c) => (c[props.idKey] ?? c.pk ?? c.id) === id);
  return hit ? (hit[props.nameKey] ?? hit.name) : `#${id}`;
}

const availableOptions = computed(() => {
  const used = new Set(effectiveIds.value);
  const q = filterQ.value.trim().toLowerCase();
  return props.catalog
    .filter((c) => !used.has(c[props.idKey] ?? c.pk ?? c.id))
    .filter((c) => !q || (c[props.nameKey] || c.name || "").toLowerCase().includes(q))
    .map((c) => ({
      value: c[props.idKey] ?? c.pk ?? c.id,
      label: c[props.nameKey] ?? c.name,
    }));
});

function onFilter(val, update) {
  update(() => { filterQ.value = val || ""; });
}

function onConfirm() {
  if (picked.value == null) return;
  emit("add", picked.value);
  picked.value = null;
  addOpen.value = false;
}
</script>

<style lang="scss" scoped>
.ex {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;

  &__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 13px;
    color: var(--color-fg-primary);
  }
  &__ic { color: var(--color-fg-secondary); }
  &__count { color: var(--color-fg-secondary); font-weight: 400; }
  &__empty {
    font-size: 13px;
    color: var(--color-fg-tertiary);
    font-style: italic;
    padding-left: 22px;
  }
  &__list {
    list-style: none;
    margin: 0;
    padding: 0 0 0 22px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: 13px;
  }
  &__name { color: var(--color-fg-primary); }
  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
  }
}
</style>
