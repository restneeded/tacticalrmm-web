// Phase R — sidebar pending-actions count badge.
// Mirrors useAlertCount: singleton ref, 60s poll, soft-fails on errors
// (axios interceptor stops polling on 4xx).

import { ref, onMounted, onUnmounted } from "vue";

import { fetchPendingActions } from "@/api/pending";

const count   = ref(0);
const loaded  = ref(false);
let timer: number | null = null;
let mountCount = 0;

async function refresh() {
  try {
    const rows = await fetchPendingActions();
    count.value = rows.filter(r => r.status === "pending").length;
    loaded.value = true;
  } catch {
    /* best-effort */
  }
}

export function usePendingCount() {
  onMounted(() => {
    mountCount += 1;
    if (mountCount === 1) {
      void refresh();
      timer = window.setInterval(refresh, 60_000);
    }
  });
  onUnmounted(() => {
    mountCount = Math.max(0, mountCount - 1);
    if (mountCount === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  });
  return { count, loaded, refresh };
}
