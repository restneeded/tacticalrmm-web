// Phase P — sidebar unresolved-alert badge composable.
//
// Polls PATCH /alerts/ {top: 0} (which returns {alerts_count, alerts: []})
// every 60s. Exposes a single reactive ref the AppShell sidebar reads.
// Keep a singleton across components so nothing duplicates the request.

import { ref, onMounted, onUnmounted } from "vue";
import { fetchTopAlerts } from "@/api/alerts";

const count = ref(0);
const loaded = ref(false);
let timer: number | null = null;
let mountCount = 0;

async function refresh() {
  try {
    const data = await fetchTopAlerts(0);
    count.value = data.alerts_count ?? 0;
    loaded.value = true;
  } catch {
    // Ignore — sidebar badge is best-effort. Polling stops on 4xx in axios
    // interceptor; a transient 5xx is recovered on the next tick.
  }
}

export function useAlertCount() {
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
