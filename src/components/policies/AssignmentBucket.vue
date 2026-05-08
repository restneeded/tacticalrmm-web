<!--
  AssignmentBucket — small read-only group of assigned targets within
  the policy detail Assignments section. One per channel
  (workstation/server/agent). Emits @remove(row) to unassign.
-->
<template>
  <div class="bk">
    <header class="bk__head">
      <q-icon :name="icon" size="14px" class="bk__ic" />
      <span class="bk__label">{{ label }}</span>
      <span class="bk__count">· {{ rows.length }}</span>
    </header>
    <div v-if="rows.length === 0" class="bk__empty">{{ emptyText }}</div>
    <ul v-else class="bk__list">
      <li v-for="row in rows" :key="row[idField] || row.pk || row.id" class="bk__item">
        <span class="bk__name">{{ row[nameField] || row.name }}</span>
        <q-btn
          flat dense round icon="close" size="xs"
          @click="$emit('remove', row)"
        >
          <q-tooltip>Remove assignment</q-tooltip>
        </q-btn>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  label:     { type: String, required: true },
  icon:      { type: String, default: "circle" },
  rows:      { type: Array,  default: () => [] },
  emptyText: { type: String, default: "No targets in this bucket." },
  nameField: { type: String, default: "name" },
  idField:   { type: String, default: "id" },
});
defineEmits(["remove"]);
</script>

<style lang="scss" scoped>
.bk {
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
  &__ic   { color: var(--color-fg-secondary); }
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
}
</style>
