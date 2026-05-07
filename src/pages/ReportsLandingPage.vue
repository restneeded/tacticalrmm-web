<!--
  Phase G — /reports landing page.
  Card-per-report grid; each card shows icon + name + lede + "View" button.
-->
<template>
  <q-page class="reports-landing">
    <header class="reports-landing__hero">
      <div>
        <h1 class="reports-landing__title">Reports</h1>
        <p class="reports-landing__lede">
          Fleet-wide compliance, software inventory, and deploy history. Each report
          can be filtered by client/site/time-range and exported to CSV.
        </p>
      </div>
    </header>

    <q-banner v-if="error" class="reports-landing__error">
      Failed to load report list: {{ error }}
    </q-banner>

    <div v-if="loading" class="reports-landing__skeleton">
      <q-skeleton v-for="i in 5" :key="i" type="QCard" class="reports-landing__skel-card" />
    </div>

    <div v-else class="reports-landing__grid" role="list">
      <router-link
        v-for="r in reports"
        :key="r.key"
        :to="`/reports/${r.key}`"
        class="reports-landing__card"
        role="listitem"
      >
        <div class="reports-landing__card-icon" aria-hidden="true">
          <q-icon :name="r.icon" size="32px" />
        </div>
        <div class="reports-landing__card-body">
          <h2 class="reports-landing__card-title">{{ r.name }}</h2>
          <p class="reports-landing__card-lede">{{ r.lede }}</p>
          <span class="reports-landing__card-meta">
            <span v-if="r.last_generated_at">
              Last viewed {{ relativeTime(r.last_generated_at) }}
            </span>
            <span v-else>Not yet viewed</span>
          </span>
        </div>
        <q-icon name="chevron_right" class="reports-landing__card-chevron" />
      </router-link>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { errMsg } from "@/utils/errMsg";

import { listReports, type ReportIndexEntry } from "@/api/reports";

const reports = ref<ReportIndexEntry[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

onMounted(async () => {
  try {
    reports.value = await listReports();
  } catch (e) {
    error.value = errMsg(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.reports-landing {
  padding: 28px 32px 64px;
  max-width: 1200px;
  margin: 0 auto;

  &__hero {
    margin-bottom: 24px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 8px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }
  &__lede {
    color: var(--color-fg-secondary);
    margin: 0;
    max-width: 720px;
  }
  &__error { margin-bottom: 16px; }
  &__skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }
  &__skel-card { height: 140px; }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }
  &__card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    color: var(--color-fg-primary);
    text-decoration: none;
    transition: border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
    box-shadow: var(--intune-shadow-1);
    &:hover {
      border-color: var(--color-accent-500);
      box-shadow: var(--intune-shadow-2);
      transform: translateY(-1px);
    }
    &:focus-visible {
      outline: 2px solid var(--color-accent-500);
      outline-offset: 2px;
    }
  }
  &__card-icon {
    width: 56px; height: 56px; flex: none;
    border-radius: var(--intune-radius-medium);
    background-color: var(--color-bg-accent-subtle);
    color: var(--color-accent-500);
    display: grid; place-items: center;
  }
  &__card-body { flex: 1; min-width: 0; }
  &__card-title {
    font-size: var(--intune-font-size-400);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 4px 0;
  }
  &__card-lede {
    color: var(--color-fg-secondary);
    margin: 0 0 6px 0;
    font-size: var(--intune-font-size-200);
    line-height: 1.3;
  }
  &__card-meta {
    font-size: var(--intune-font-size-100);
    color: var(--color-fg-tertiary);
  }
  &__card-chevron {
    color: var(--color-fg-tertiary);
    flex: none;
  }
}
</style>
