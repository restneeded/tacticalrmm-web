<!--
  Phase G — shared shell for every report detail page.
  Owns the breadcrumb, hero, filter bar, and slot for body. Each report
  page mounts this once and renders its summary cards + table inside.
-->
<template>
  <q-page class="report-shell">
    <nav class="report-shell__crumbs" aria-label="Breadcrumbs">
      <router-link to="/reports" class="report-shell__crumb-link">Reports</router-link>
      <q-icon name="chevron_right" size="14px" />
      <span class="report-shell__crumb-current">{{ title }}</span>
    </nav>

    <header class="report-shell__hero">
      <div class="report-shell__hero-icon">
        <q-icon :name="icon" size="32px" />
      </div>
      <div>
        <h1 class="report-shell__title">{{ title }}</h1>
        <p class="report-shell__lede">{{ lede }}</p>
      </div>
    </header>

    <ReportFilterBar
      :model-value="filters"
      :clients="clients"
      :sites="sites"
      :csv-href="csvHref"
      :freshness="freshness"
      @update:model-value="$emit('update:filters', $event)"
    />

    <q-banner v-if="error" class="report-shell__error">
      Failed to load report: {{ error }}
    </q-banner>

    <slot v-if="!error" />
  </q-page>
</template>

<script setup lang="ts">
import type { ReportFiltersInput } from "@/api/reports";
import ReportFilterBar from "./ReportFilterBar.vue";

defineProps<{
  title: string;
  icon: string;
  lede: string;
  filters: ReportFiltersInput;
  clients: Array<{ id: number; name: string }>;
  sites: Array<{ id: number; name: string; client_name?: string; client?: number }>;
  csvHref?: string;
  freshness?: string;
  error?: string | null;
}>();
defineEmits<{
  (e: "update:filters", v: ReportFiltersInput): void;
}>();
</script>

<style lang="scss" scoped>
.report-shell {
  padding: 24px 32px 64px;
  max-width: 1280px;
  margin: 0 auto;

  &__crumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    margin-bottom: 12px;
  }
  &__crumb-link {
    color: var(--color-fg-secondary);
    text-decoration: none;
    &:hover { color: var(--color-accent-500); text-decoration: underline; }
  }
  &__crumb-current {
    color: var(--color-fg-primary);
    font-weight: var(--intune-font-weight-medium);
  }

  &__hero {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  &__hero-icon {
    width: 48px; height: 48px;
    border-radius: var(--intune-radius-medium);
    background-color: var(--color-bg-accent-subtle);
    color: var(--color-accent-500);
    display: grid; place-items: center;
    flex: none;
  }
  &__title {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 4px 0;
    color: var(--color-fg-primary);
  }
  &__lede {
    margin: 0;
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
  }

  &__error { margin-bottom: 16px; }
}
</style>
