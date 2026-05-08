<!--
  Phase T2 — shared section card chrome.
  Title + lede + slot. Single-purpose presentational wrapper used by every
  Settings section to keep visual rhythm consistent.
-->
<template>
  <article class="scard">
    <header class="scard__head">
      <h2 class="scard__title">{{ title }}</h2>
      <p v-if="lede" class="scard__lede">{{ lede }}</p>
    </header>
    <div class="scard__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="scard__foot">
      <slot name="footer" />
    </footer>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  lede?: string;
}>();
</script>

<style lang="scss" scoped>
.scard {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  box-shadow: var(--intune-shadow-1);
  display: flex;
  flex-direction: column;

  &__head {
    padding: 18px 24px 8px 24px;
  }
  &__title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 4px 0;
    color: var(--color-fg-primary);
  }
  &__lede {
    color: var(--color-fg-secondary);
    margin: 0;
    font-size: var(--intune-font-size-200);
  }
  &__body {
    padding: 8px 24px 18px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  &__foot {
    border-top: 1px solid var(--color-stroke-divider);
    padding: 12px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
