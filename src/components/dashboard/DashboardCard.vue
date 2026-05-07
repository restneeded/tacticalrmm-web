<!--
  DashboardCard — generic card chrome for every tile.
  Owns: padding, border, radius, hover, loading shimmer, error/empty slot fallback.
  Children supply: header, body via slots.
-->
<template>
  <component
    :is="to ? 'router-link' : 'section'"
    class="d-card"
    :class="{ 'd-card--clickable': !!to, 'd-card--accent': !!accent }"
    :to="to"
    :data-accent="accent"
    :aria-label="ariaLabel || title"
    role="region"
  >
    <header v-if="title || icon" class="d-card__header">
      <q-icon
        v-if="icon"
        :name="icon"
        size="20px"
        class="d-card__icon"
        aria-hidden="true"
      />
      <h2 class="d-card__title">{{ title }}</h2>
      <slot name="header-trailing" />
    </header>

    <div v-if="loading" class="d-card__skeleton" aria-busy="true">
      <span class="d-card__skel-line d-card__skel-line--strong" />
      <span class="d-card__skel-line" />
      <span class="d-card__skel-line d-card__skel-line--short" />
    </div>
    <div v-else-if="error" class="d-card__state d-card__state--error" role="alert">
      <q-icon name="error_outline" size="20px" />
      <span>{{ error }}</span>
    </div>
    <div v-else class="d-card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="d-card__footer">
      <slot name="footer" />
    </footer>
  </component>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineProps<{
  title?: string;
  icon?: string;
  to?: RouteLocationRaw;
  loading?: boolean;
  error?: string | null;
  /** "ok" | "warn" | "danger" | "info" — left edge accent for status tiles */
  accent?: "ok" | "warn" | "danger" | "info";
  ariaLabel?: string;
}>();
</script>

<style lang="scss" scoped>
.d-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-large);
  padding: 18px 20px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--intune-duration-fast) var(--intune-curve-easy-ease),
              border-color var(--intune-duration-fast) var(--intune-curve-easy-ease),
              transform var(--intune-duration-fast) var(--intune-curve-easy-ease);

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    border-top-left-radius: var(--intune-radius-large);
    border-bottom-left-radius: var(--intune-radius-large);
    background-color: transparent;
    transition: background-color var(--intune-duration-fast) var(--intune-curve-easy-ease);
  }

  &--accent {
    &[data-accent="ok"]::before     { background-color: var(--intune-status-success); }
    &[data-accent="warn"]::before   { background-color: var(--intune-status-warning); }
    &[data-accent="danger"]::before { background-color: var(--intune-status-danger); }
    &[data-accent="info"]::before   { background-color: var(--intune-status-info); }
  }

  &--clickable {
    cursor: pointer;
    &:hover {
      box-shadow: var(--intune-shadow-8);
      border-color: var(--color-stroke-control);
    }
    &:focus-visible {
      outline: 2px solid var(--color-stroke-focus);
      outline-offset: 2px;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-fg-primary);
  }
  &__icon {
    color: var(--color-brand-rest);
  }
  &__title {
    font-size: var(--intune-font-size-300);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
    letter-spacing: 0.1px;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
  }

  &__body {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__footer {
    border-top: 1px solid var(--color-stroke-divider);
    padding-top: 10px;
    margin-top: 4px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }

  &__state {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--intune-status-danger);
    font-size: var(--intune-font-size-300);
    &--error :deep(.q-icon) {
      color: var(--intune-status-danger);
    }
  }

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 0 12px 0;
  }
  &__skel-line {
    display: block;
    height: 12px;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      var(--color-bg-surface-2) 0%,
      var(--color-bg-surface-3) 50%,
      var(--color-bg-surface-2) 100%
    );
    background-size: 200% 100%;
    animation: d-card-shimmer 1.4s var(--intune-curve-easy-ease) infinite;
    width: 100%;
    &--strong {
      height: 28px;
      width: 55%;
    }
    &--short { width: 35%; }
  }
}

@keyframes d-card-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
