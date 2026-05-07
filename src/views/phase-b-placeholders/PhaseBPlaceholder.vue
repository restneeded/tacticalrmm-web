<template>
  <q-page padding class="phase-b-placeholder">
    <div class="phase-b-placeholder__card">
      <q-icon :name="icon" size="40px" class="phase-b-placeholder__icon" />
      <h1 class="phase-b-placeholder__title">{{ title }}</h1>
      <p class="phase-b-placeholder__lede">{{ lede }}</p>

      <div class="phase-b-placeholder__phase">
        Coming in <strong>{{ phase }}</strong>
      </div>

      <div class="phase-b-placeholder__legacy">
        Need this functionality now? It still lives in the
        <router-link to="/legacy" class="phase-b-placeholder__legacy-link">
          legacy dashboard
        </router-link>.
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  icon: string;
  lede: string;
  phase: string;
}>();
</script>

<style lang="scss" scoped>
.phase-b-placeholder {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - 60px);
  padding: 48px 24px;

  &__card {
    width: 100%;
    max-width: 640px;
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-large);
    box-shadow: var(--intune-shadow-2);
    padding: 40px;
    text-align: left;
  }

  &__icon {
    color: var(--color-brand-rest);
    margin-bottom: var(--intune-space-l);
  }

  &__title {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.2;
    margin: 0 0 var(--intune-space-s) 0;
    color: var(--color-fg-primary);
  }

  &__lede {
    font-size: var(--intune-font-size-400);
    line-height: 1.5;
    color: var(--color-fg-secondary);
    margin: 0 0 var(--intune-space-xxl) 0;
  }

  &__phase {
    display: inline-block;
    background-color: var(--color-brand-bg-rest);
    color: var(--color-brand-rest);
    font-size: var(--intune-font-size-300);
    font-weight: var(--intune-font-weight-semibold);
    padding: 6px 12px;
    border-radius: var(--intune-radius-circular);
    margin-bottom: var(--intune-space-l);
  }

  &__legacy {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-tertiary);
    border-top: 1px solid var(--color-stroke-divider);
    padding-top: var(--intune-space-l);
    margin-top: var(--intune-space-l);
  }
  &__legacy-link {
    color: var(--color-brand-rest);
    text-decoration: none;
    font-weight: var(--intune-font-weight-semibold);
    &:hover { text-decoration: underline; }
  }
}
</style>
