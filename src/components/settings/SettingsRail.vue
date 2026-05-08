<!--
  Phase T2 — Settings left rail.
  Sticky list of section anchors with active-state highlight.
-->
<template>
  <nav class="srail" aria-label="Settings sections">
    <ul class="srail__list">
      <li
        v-for="s in sections"
        :key="s.id"
        class="srail__item"
        :class="{ 'srail__item--active': s.id === active }"
      >
        <button
          type="button"
          class="srail__btn"
          :aria-current="s.id === active ? 'true' : undefined"
          @click="$emit('select', s.id)"
        >
          {{ s.title }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  sections: { id: string; title: string }[];
  active: string;
}>();
defineEmits<{
  (e: "select", id: string): void;
}>();
</script>

<style lang="scss" scoped>
.srail {
  position: sticky;
  top: 16px;
  align-self: start;

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__item {
    border-left: 2px solid transparent;
  }
  &__item--active {
    border-left-color: var(--color-accent-500);
    background-color: var(--color-bg-surface-2, transparent);
  }

  &__btn {
    appearance: none;
    background: none;
    border: none;
    text-align: left;
    width: 100%;
    padding: 8px 12px;
    font: inherit;
    color: var(--color-fg-secondary);
    cursor: pointer;
    border-radius: 0 var(--intune-radius-medium) var(--intune-radius-medium) 0;
  }
  &__item--active .srail__btn {
    color: var(--color-fg-primary);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__btn:hover {
    color: var(--color-fg-primary);
    background-color: var(--color-bg-surface-2);
  }
  &__btn:focus-visible {
    outline: 2px solid var(--color-accent-500);
    outline-offset: 2px;
  }
}
</style>
