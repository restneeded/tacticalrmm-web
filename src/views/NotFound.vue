<!--
  NotFound — Phase T5 404 page rendered inside AppShell.

  Direct-load and SPA-nav of unknown URLs land here so users keep the
  topbar + sidebar chrome instead of dropping to a naked page or
  Django debug overlay. Reuses the AppShell empty-state visual pattern
  (centered icon + title + lede) and exposes the attempted path so
  users can spot typos.
-->
<template>
  <q-page class="not-found">
    <div class="not-found__inner">
      <q-icon name="search_off" size="64px" class="not-found__icon" />
      <h1 class="not-found__title">Page not found</h1>
      <p class="not-found__lede">
        We couldn't find anything at this address.
      </p>
      <code class="not-found__path" :title="attemptedPath">{{ attemptedPath }}</code>

      <div class="not-found__actions">
        <q-btn
          unelevated
          color="primary"
          icon="home"
          label="Back to Dashboard"
          @click="goHome"
        />
        <q-btn
          flat
          color="primary"
          icon="arrow_back"
          label="Go back"
          @click="goBack"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const attemptedPath = computed(() => route.fullPath);

function goHome() {
  router.push("/");
}

function goBack() {
  router.back();
}
</script>

<style lang="scss" scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48px 24px;

  &__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 560px;
  }

  &__icon {
    color: var(--color-fg-tertiary);
    margin-bottom: 16px;
  }

  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 8px 0;
    color: var(--color-fg-primary);
  }

  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0 0 16px 0;
  }

  &__path {
    display: inline-block;
    padding: 6px 12px;
    border-radius: var(--intune-radius-medium, 6px);
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
    font-family: var(--intune-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    margin-bottom: 28px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
