<!-- Phase T1 — topbar notifications panel.
     - Badge driven by existing useAlertCount (60s polling, singleton)
     - Panel: top 5 unresolved alerts via fetchTopAlerts(5), 60s poll while mounted
     - "View all" → /alerts
     - Empty state: "No active alerts." -->
<template>
  <q-btn
    flat
    round
    dense
    icon="notifications_none"
    aria-label="Notifications"
    class="topbar-bell"
  >
    <q-badge
      v-if="alertCount > 0"
      floating
      color="negative"
      :label="badgeLabel"
    />
    <q-menu
      anchor="bottom right"
      self="top right"
      :offset="[0, 6]"
      class="topbar-bell__menu"
    >
      <div class="topbar-bell__panel">
        <div class="topbar-bell__head">
          <span class="topbar-bell__title">Notifications</span>
          <q-space />
          <span class="text-caption text-grey-6"
            >{{ alertCount }} active</span
          >
        </div>
        <q-separator />
        <q-list dense>
          <template v-if="loading && top.length === 0">
            <q-item>
              <q-item-section class="text-caption text-grey-6"
                >Loading…</q-item-section
              >
            </q-item>
          </template>
          <template v-else-if="top.length === 0">
            <q-item>
              <q-item-section class="text-caption text-grey-6"
                >No active alerts.</q-item-section
              >
            </q-item>
          </template>
          <template v-else>
            <q-item
              v-for="a in top"
              :key="a.id"
              v-close-popup
              clickable
              @click="openAlerts"
            >
              <q-item-section avatar>
                <q-icon
                  :name="severityIcon(a.severity)"
                  :color="severityColor(a.severity)"
                  size="18px"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label lines="2">{{
                  a.message || a.alert_type
                }}</q-item-label>
                <q-item-label caption lines="1"
                  >{{ a.hostname || a.client || "—" }} ·
                  {{ formatTime(a.alert_time) }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </template>
        </q-list>
        <q-separator />
        <q-item v-close-popup clickable class="text-primary" @click="openAlerts">
          <q-item-section align="center">View all</q-item-section>
        </q-item>
      </div>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { fetchTopAlerts } from "@/api/alerts";
import { useAlertCount } from "@/composables/useAlertCount";
import type { AlertRow } from "@/types/alerts";

const router = useRouter();
const { count: alertCount } = useAlertCount();

const top = ref<AlertRow[]>([]);
const loading = ref(false);
let timer: number | null = null;

const badgeLabel = computed(() =>
  alertCount.value > 99 ? "99+" : String(alertCount.value),
);

async function refreshTop() {
  loading.value = true;
  try {
    const data = await fetchTopAlerts(5);
    top.value = data.alerts ?? [];
  } catch {
    /* best-effort — axios interceptor stops polling on 4xx */
  } finally {
    loading.value = false;
  }
}

function severityIcon(s: AlertRow["severity"]) {
  if (s === "error") return "error";
  if (s === "warning") return "warning";
  return "info";
}
function severityColor(s: AlertRow["severity"]) {
  if (s === "error") return "negative";
  if (s === "warning") return "warning";
  return "primary";
}
function formatTime(t: string | null) {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function openAlerts() {
  void router.push("/alerts");
}

onMounted(() => {
  void refreshTop();
  timer = window.setInterval(refreshTop, 60_000);
});
onUnmounted(() => {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
});
</script>

<style lang="scss" scoped>
.topbar-bell__panel {
  min-width: 320px;
  max-width: 420px;
}
.topbar-bell__head {
  display: flex;
  align-items: center;
  padding: 8px 16px;
}
.topbar-bell__title {
  font-weight: var(--intune-font-weight-semibold);
}
</style>
