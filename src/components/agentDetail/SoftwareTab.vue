<!--
  SoftwareTab — apps installed on this agent.

  Endpoint: GET /software/<agent_id>/  (legacy, returns full per-agent
  list with name/publisher/version/install_date/install_location).

  Phase D's normalized inventory model is fleet-level (InstalledApp)
  and doesn't currently expose a per-agent endpoint that returns the
  joined Phase-D shape. Building one is a backend addition we don't
  need for Phase J: the legacy per-agent endpoint already gives us
  everything the table requires. The "managed" badge is shown when
  the row's `name` matches a Phase-D managed app — that's only useful
  once Phase D coverage grows; for now the badge is hidden if no
  match data is available rather than fabricating a state.

  Click-through: row click takes the user to /software with a search
  pre-applied for the app's display name.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Search app, publisher, version…"
        class="ad-tab__search"
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        :loading="loading"
        @click="load"
      />
    </header>

    <div v-if="loading && apps.length === 0" class="state">Loading software…</div>
    <div v-else-if="errorMsg && apps.length === 0" class="state state--error">
      Couldn't load software: {{ errorMsg }}
    </div>
    <div v-else-if="apps.length === 0" class="state">
      No software inventory recorded for this agent yet.
    </div>
    <div v-else-if="filtered.length === 0" class="state">
      No apps match the current search.
    </div>
    <div v-else class="table">
      <div class="table__head">
        <span>Name</span>
        <span>Publisher</span>
        <span>Version</span>
        <span>Installed</span>
        <span></span>
      </div>
      <div
        v-for="(row, i) in pagedRows"
        :key="`${row.name}-${row.version}-${i}`"
        class="table__row"
        @click="openInCatalog(row)"
      >
        <span class="table__name">
          <span class="table__title" :title="row.name">{{ row.name || "—" }}</span>
          <span v-if="row.size" class="table__size">{{ row.size }}</span>
        </span>
        <span :title="row.publisher || ''">{{ row.publisher || "—" }}</span>
        <span>{{ row.version || "—" }}</span>
        <span>{{ row.install_date || "—" }}</span>
        <span class="table__chev">›</span>
      </div>
      <div v-if="filtered.length > pageSize" class="table__pager">
        Showing {{ pagedRows.length }} of {{ filtered.length }}
        <q-btn
          flat
          dense
          no-caps
          label="Load more"
          :disable="pagedRows.length >= filtered.length"
          @click="page = page + 1"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { fetchAgentSoftware } from "@/api/software";

interface AgentApp {
  name: string;
  publisher: string;
  version: string;
  install_date: string;
  install_location?: string;
  size?: string;
}

const props = defineProps<{ agentId: string }>();
const router = useRouter();

const apps = ref<AgentApp[]>([]);
const loading = ref(true);
const errorMsg = ref("");
const search = ref("");
const page = ref(1);
const pageSize = 50;

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  page.value = 1;
  try {
    const data = (await fetchAgentSoftware(props.agentId)) as AgentApp[] | undefined;
    apps.value = Array.isArray(data) ? data : [];
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return apps.value;
  return apps.value.filter((r) =>
    `${r.name} ${r.publisher} ${r.version}`.toLowerCase().includes(q),
  );
});

const pagedRows = computed(() => filtered.value.slice(0, page.value * pageSize));

function openInCatalog(row: AgentApp) {
  if (!row.name) return;
  router.push({ name: "Software", query: { q: row.name } });
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

watch(() => props.agentId, load);
onMounted(load);
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  &__search { min-width: 280px; }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;
  &--error { color: var(--color-state-negative-fg, #a40e26); }
}

.table {
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;

  &__head, &__row {
    display: grid;
    grid-template-columns: minmax(0, 2.5fr) minmax(0, 2fr) 130px 130px 24px;
    gap: 12px;
    padding: 8px 14px;
    font-size: 13px;
    align-items: center;
  }
  &__head {
    color: var(--color-fg-secondary);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    background: var(--color-bg-page);
    border-bottom: 1px solid var(--color-border-subtle);
  }
  &__row {
    border-bottom: 1px solid var(--color-border-subtle);
    cursor: pointer;
    &:hover { background: var(--color-bg-page); }
    &:last-child { border-bottom: none; }
  }
  &__name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }
  &__title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__size {
    font-size: 11px;
    color: var(--color-fg-secondary);
  }
  &__chev { color: var(--color-fg-secondary); }
  &__pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 10px 14px;
    font-size: 12px;
    color: var(--color-fg-secondary);
    background: var(--color-bg-page);
    border-top: 1px solid var(--color-border-subtle);
  }
}
</style>
