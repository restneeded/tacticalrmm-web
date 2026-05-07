<!--
  VersionStatusCard — current TRMM version vs latest available.
  Source: GET /core/dashinfo/ (existing endpoint).
-->
<template>
  <DashboardCard
    title="TRMM version"
    icon="rocket_launch"
    :loading="loading"
    :error="error"
    :accent="accent"
    aria-label="TRMM version status"
  >
    <div class="ver">
      <span class="ver__current">v{{ current || "—" }}</span>
      <span
        v-if="upToDate"
        class="ver__badge ver__badge--ok"
      >Up to date</span>
      <span
        v-else-if="latest"
        class="ver__badge ver__badge--warn"
      >Update available</span>
    </div>
    <p class="ver__caption">
      <template v-if="upToDate">Running the latest release.</template>
      <template v-else-if="latest">
        Latest is <strong>v{{ latest }}</strong>.
      </template>
      <template v-else>Could not determine latest version.</template>
    </p>
  </DashboardCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import DashboardCard from "./DashboardCard.vue";
import { fetchDashboardInfo } from "@/api/core";

const loading = ref(true);
const error = ref<string | null>(null);
const current = ref<string>("");
const latest = ref<string>("");

onMounted(async () => {
  try {
    const info = await fetchDashboardInfo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const i = info as any;
    current.value = String(i?.trmm_version || "");
    latest.value = String(i?.latest_trmm_ver || "");
  } catch (e) {
    error.value = "Could not load version";
    // eslint-disable-next-line no-console
    console.error("[dashboard] version:", e);
  } finally {
    loading.value = false;
  }
});

const upToDate = computed(
  () => !!current.value && !!latest.value && current.value === latest.value,
);

const accent = computed<"ok" | "warn" | undefined>(() => {
  if (loading.value || error.value) return undefined;
  return upToDate.value ? "ok" : "warn";
});
</script>

<style lang="scss" scoped>
.ver {
  display: flex;
  align-items: center;
  gap: 10px;
  &__current {
    font-size: var(--intune-font-size-700);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1;
    color: var(--color-fg-primary);
  }
  &__badge {
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-semibold);
    padding: 3px 8px;
    border-radius: var(--intune-radius-circular);
    &--ok {
      color: var(--intune-status-success);
      background-color: rgba(16, 124, 16, 0.12);
    }
    &--warn {
      color: var(--intune-status-warning);
      background-color: rgba(247, 99, 12, 0.14);
    }
  }
  &__caption {
    margin: 8px 0 0 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
}
</style>
