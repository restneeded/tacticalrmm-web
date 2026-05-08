<template>
  <q-dialog v-model="open" persistent @hide="onHide">
    <q-card class="deploy-dialog" role="dialog" aria-labelledby="deploy-title">
      <q-card-section class="deploy-dialog__header">
        <h2 id="deploy-title" class="deploy-dialog__title">
          Deploy <span class="deploy-dialog__app-name">{{ pkg.display_name }}</span>
        </h2>
        <p class="deploy-dialog__subtitle">
          via Chocolatey · <code>{{ pkg.package_id }}</code>
          <span v-if="pkg.publisher"> · {{ pkg.publisher }}</span>
        </p>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close"
          @click="open = false"
          class="deploy-dialog__close"
        />
      </q-card-section>

      <q-card-section class="deploy-dialog__targets">
        <div class="deploy-dialog__section-title">Target machines</div>
        <p class="deploy-dialog__hint">
          Pick by client, by site, or by individual agent. Already-installed
          agents are skipped — use Discovery → Take Over to manage those.
        </p>

        <div class="deploy-dialog__picker-mode">
          <q-btn-toggle
            v-model="targetMode"
            dense
            spread
            no-caps
            :options="targetModeOptions"
            toggle-color="primary"
            class="deploy-dialog__mode-toggle"
          />
        </div>

        <q-select
          v-if="targetMode === 'clients'"
          v-model="pickedClients"
          :options="clientOptions"
          multiple
          dense
          outlined
          use-chips
          emit-value
          map-options
          option-label="name"
          option-value="id"
          input-debounce="200"
          label="Pick one or more clients"
          class="deploy-dialog__picker"
        />

        <q-select
          v-if="targetMode === 'sites'"
          v-model="pickedSites"
          :options="siteOptions"
          multiple
          dense
          outlined
          use-chips
          emit-value
          map-options
          option-label="label"
          option-value="id"
          input-debounce="200"
          label="Pick one or more sites"
          class="deploy-dialog__picker"
        />

        <q-select
          v-if="targetMode === 'agents'"
          v-model="pickedAgents"
          :options="filteredAgentOptions"
          multiple
          dense
          outlined
          use-chips
          use-input
          emit-value
          map-options
          option-label="label"
          option-value="agent_id"
          input-debounce="200"
          label="Search and pick agents"
          @filter="filterAgents"
          class="deploy-dialog__picker"
        />

        <q-select
          v-if="targetMode === 'savedView'"
          v-model="pickedSavedView"
          :options="savedViewOptions"
          dense
          outlined
          emit-value
          map-options
          option-label="name"
          option-value="id"
          label="Pick a saved view from /devices"
          class="deploy-dialog__picker"
        />
        <p v-if="targetMode === 'savedView' && savedViewOptions.length === 0" class="deploy-dialog__empty-saved">
          You don't have any saved views yet. Create one on /devices first.
        </p>

        <div class="deploy-dialog__count" :class="{ 'deploy-dialog__count--zero': computedTargetCount === 0 }">
          <q-icon name="group" size="18px" />
          {{ computedTargetCount }} agent{{ computedTargetCount === 1 ? '' : 's' }} selected
        </div>
        <!-- Phase G: cache freshness indicator. -->
        <div v-if="cacheFreshLabel" class="deploy-dialog__cache-fresh">
          <q-icon name="cached" size="14px" aria-hidden="true" />
          {{ cacheFreshLabel }}
          <q-btn
            flat dense no-caps size="sm" label="Refresh"
            @click="refreshCacheNow"
            class="deploy-dialog__refresh-btn"
            :aria-label="'Refresh clients and sites cache'"
          />
        </div>
      </q-card-section>

      <q-card-section class="deploy-dialog__options">
        <div class="deploy-dialog__section-title">Reboot strategy</div>
        <q-btn-toggle
          v-model="rebootStrategy"
          dense
          spread
          no-caps
          :options="rebootOptions"
          toggle-color="primary"
        />
      </q-card-section>

      <q-card-actions class="deploy-dialog__actions" align="right">
        <q-btn flat no-caps label="Cancel" @click="open = false" :disable="submitting" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          icon-right="rocket_launch"
          label="Deploy"
          :loading="submitting"
          :disable="!canSubmit"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import axios from "axios";
import { useQuasar } from "quasar";

import { useAuthStore } from "@/stores/auth";
import { useClientsCacheStore } from "@/stores/clientsCache";
import {
  createDeployJob,
  type CatalogPackage,
  type DeployCreateResponse,
  type DeployTarget,
} from "@/api/softwareInventory";

const props = defineProps<{ pkg: CatalogPackage }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "deployed", resp: DeployCreateResponse): void;
}>();

const $q = useQuasar();
const open = ref(true);

type TargetMode = "clients" | "sites" | "agents" | "savedView";
const targetMode = ref<TargetMode>("clients");
const targetModeOptions: { label: string; value: TargetMode }[] = [
  { label: "Clients", value: "clients" },
  { label: "Sites", value: "sites" },
  { label: "Agents", value: "agents" },
  { label: "Saved view", value: "savedView" },
];

const pickedClients = ref<number[]>([]);
const pickedSites = ref<number[]>([]);
const pickedAgents = ref<string[]>([]);
const pickedSavedView = ref<string | null>(null);

const rebootStrategy = ref<"none" | "prompt" | "force">("none");
const rebootOptions = [
  { label: "Never reboot", value: "none" },
  { label: "Prompt user", value: "prompt" },
  { label: "Force when required", value: "force" },
];

const submitting = ref(false);

interface ClientRow { id: number; name: string }
interface SiteRow { id: number; name: string; client_name: string; label: string }
interface AgentRow { agent_id: string; hostname: string; site: string; client: string; label: string }

const clientOptions = ref<ClientRow[]>([]);
const siteOptions = ref<SiteRow[]>([]);
const allAgents = ref<AgentRow[]>([]);
const filteredAgentOptions = ref<AgentRow[]>([]);

interface SavedViewRow { id: string; name: string; agent_ids: string[] }
const savedViewOptions = ref<SavedViewRow[]>([]);
const cacheAge = ref<number>(-1);
const cacheFreshLabel = computed(() => {
  if (cacheAge.value < 0) return "";
  if (cacheAge.value < 5) return "Fresh";
  if (cacheAge.value < 60) return `Cached ${cacheAge.value}s ago`;
  return `Cached ${Math.floor(cacheAge.value / 60)}m ago`;
});
async function refreshCacheNow() {
  const cache = useClientsCacheStore();
  await cache.refresh();
  await loadPickerData();
}

function authConfig() {
  const auth = useAuthStore();
  const tok = auth.token as string | null;
  return tok ? { headers: { Authorization: `Token ${tok}` } } : {};
}

async function loadPickerData() {
  try {
    // Phase G: clients + sites come from the 60s-TTL Pinia cache so re-
    // opening the modal in a session doesn't re-fetch. Agent list is one-
    // shot per dialog open since the fleet can change anytime an agent
    // checks in. The freshness label below the picker tells admins how
    // stale the client/site list is.
    const cache = useClientsCacheStore();
    await cache.ensureFresh();
    const [agents] = await Promise.all([
      axios.get("/agents/?detail=false", authConfig()),
    ]);
    clientOptions.value = cache.clients.map((c) => ({ id: c.id, name: c.name }));
    siteOptions.value = cache.sites.map((s) => ({
      id: s.id,
      name: s.name,
      client_name: s.client_name,
      label: `${s.client_name} / ${s.name}`,
    }));
    cacheAge.value = cache.ageSeconds;
    const data = Array.isArray(agents.data) ? agents.data : agents.data?.results || [];
    allAgents.value = data.map((a: { agent_id: string; hostname: string; site?: string; client?: string }) => ({
      agent_id: a.agent_id,
      hostname: a.hostname,
      site: a.site || "",
      client: a.client || "",
      label: `${a.hostname}${a.client ? ` · ${a.client}` : ""}`,
    }));
    filteredAgentOptions.value = allAgents.value.slice(0, 50);

    // Saved views — Phase C stored these in localStorage under "devices:savedViews"
    try {
      const raw = localStorage.getItem("devices:savedViews");
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; name: string; agent_ids?: string[] }>;
        savedViewOptions.value = parsed
          .filter((v) => Array.isArray(v.agent_ids) && v.agent_ids.length > 0)
          .map((v) => ({ id: v.id, name: v.name, agent_ids: v.agent_ids || [] }));
      }
    } catch {
      // localStorage parse failed — ignore.
    }
  } catch (e) {
    $q.notify({
      type: "negative",
      message: `Couldn't load target picker data: ${(e as Error).message}`,
      timeout: 4000,
    });
  }
}

function filterAgents(needle: string, update: (cb: () => void) => void) {
  update(() => {
    const q = needle.toLowerCase();
    if (!q) {
      filteredAgentOptions.value = allAgents.value.slice(0, 50);
      return;
    }
    filteredAgentOptions.value = allAgents.value
      .filter(
        (a) =>
          a.hostname.toLowerCase().includes(q) ||
          a.client.toLowerCase().includes(q) ||
          a.site.toLowerCase().includes(q),
      )
      .slice(0, 100);
  });
}

const computedTargetCount = computed(() => {
  if (targetMode.value === "agents") return pickedAgents.value.length;
  if (targetMode.value === "clients") {
    if (!pickedClients.value.length) return 0;
    return allAgents.value.filter((a) =>
      pickedClients.value.some((cid) => clientOptions.value.find((c) => c.id === cid)?.name === a.client),
    ).length;
  }
  if (targetMode.value === "sites") {
    if (!pickedSites.value.length) return 0;
    return allAgents.value.filter((a) =>
      pickedSites.value.some((sid) => {
        const s = siteOptions.value.find((x) => x.id === sid);
        return s && a.site === s.name && a.client === s.client_name;
      }),
    ).length;
  }
  if (targetMode.value === "savedView" && pickedSavedView.value) {
    const v = savedViewOptions.value.find((x) => x.id === pickedSavedView.value);
    return v ? v.agent_ids.length : 0;
  }
  return 0;
});

const canSubmit = computed(() => computedTargetCount.value > 0 && !submitting.value);

async function onSubmit() {
  submitting.value = true;
  try {
    const targets: DeployTarget = {};
    if (targetMode.value === "agents") {
      targets.agent_ids = pickedAgents.value;
    } else if (targetMode.value === "clients") {
      targets.client_ids = pickedClients.value;
    } else if (targetMode.value === "sites") {
      targets.site_ids = pickedSites.value;
    } else if (targetMode.value === "savedView" && pickedSavedView.value) {
      const v = savedViewOptions.value.find((x) => x.id === pickedSavedView.value);
      if (v) targets.agent_ids = v.agent_ids;
    }
    const resp = await createDeployJob({
      source: "choco",
      package_id: props.pkg.package_id,
      display_name: props.pkg.display_name,
      publisher: props.pkg.publisher,
      targets,
      options: { reboot_strategy: rebootStrategy.value },
    });
    open.value = false;
    emit("deployed", resp);
  } catch (e) {
    const msg = (e as { response?: { data?: string } }).response?.data ?? (e as Error).message;
    $q.notify({ type: "negative", message: `Deploy failed: ${msg}`, timeout: 5000 });
  } finally {
    submitting.value = false;
  }
}

function onHide() {
  emit("close");
}

onMounted(loadPickerData);
</script>

<style lang="scss" scoped>
.deploy-dialog {
  width: 600px;
  max-width: 92vw;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);
  border-radius: var(--intune-radius-large);

  &__header {
    position: relative;
    padding-right: 56px;
  }
  &__title {
    margin: 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
  }
  &__app-name { color: var(--intune-color-primary); }
  &__subtitle {
    margin: var(--intune-space-xs) 0 0;
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-300);
  }
  &__close {
    position: absolute;
    top: var(--intune-space-m);
    right: var(--intune-space-m);
  }

  &__section-title {
    font-weight: var(--intune-font-weight-semibold);
    margin-bottom: var(--intune-space-s);
  }
  &__hint {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    margin-top: 0;
    margin-bottom: var(--intune-space-m);
  }
  &__picker-mode { margin-bottom: var(--intune-space-m); }
  &__picker { margin-top: var(--intune-space-s); }
  &__count {
    margin-top: var(--intune-space-m);
    color: var(--color-fg-secondary);
    display: flex;
    align-items: center;
    gap: var(--intune-space-xs);

    &--zero { color: var(--color-fg-tertiary); }
  }
  &__empty-saved {
    margin-top: var(--intune-space-s);
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
  }
  &__actions { padding: var(--intune-space-m) var(--intune-space-l); }
}
</style>
