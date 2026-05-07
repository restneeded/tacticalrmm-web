// Phase G — shared composable for report pages. Owns the filter state, the
// in-memory clients/sites cache, and a tiny "freshness" timestamp the bar
// renders. Each report page calls this once.

import { ref } from "vue";

import type { ReportFiltersInput } from "@/api/reports";
import { useClientsCacheStore } from "@/stores/clientsCache";

export function useReportFilters() {
  const filters = ref<ReportFiltersInput>({ range: "30", client_id: null, site_id: null });
  const cache = useClientsCacheStore();
  const lastFetchedAt = ref<number | null>(null);

  // Fire once on mount via the store's freshness check.
  cache.ensureFresh().then(() => {
    lastFetchedAt.value = cache.fetchedAt;
  });

  function freshnessLabel(): string | undefined {
    if (lastFetchedAt.value == null) return undefined;
    const ageSec = Math.round((Date.now() - lastFetchedAt.value) / 1000);
    if (ageSec < 5) return undefined; // fresh, no need to mention
    if (ageSec < 60) return `Clients/sites cached ${ageSec}s ago`;
    return `Clients/sites cached ${Math.floor(ageSec / 60)}m ago`;
  }

  return { filters, cache, lastFetchedAt, freshnessLabel };
}
