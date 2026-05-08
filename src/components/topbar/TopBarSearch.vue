<!-- Phase T1 — global topbar search.
     v1 scope: agents + clients + sites, all client-side, max 5 per group.
     - ⌘K / Ctrl+K to focus, Esc to clear+blur
     - Min 2 chars before showing results
     - Lazy-loads devices store + clientsCache on first focus
     - Click navigates to detail (/devices/:agent_id, /clients/:id, /sites/:id).
       Phase T7 wired clients/sites to their new detail pages. -->
<template>
  <div class="topbar-search">
    <q-icon name="search" size="16px" class="topbar-search__icon" />
    <input
      ref="inputRef"
      v-model="query"
      class="topbar-search__input"
      type="text"
      placeholder="Search agents, clients, sites…"
      aria-label="Search agents, clients, sites"
      @focus="onFocus"
      @keydown.escape.prevent="clearAndBlur"
    />
    <span class="topbar-search__hint">{{ hintLabel }}</span>

    <q-menu
      v-model="menuOpen"
      no-parent-event
      no-focus
      no-refocus
      anchor="bottom left"
      self="top left"
      :offset="[0, 4]"
      class="topbar-search__menu"
    >
      <q-list dense style="min-width: 360px; max-width: 480px">
        <template v-if="loading && !hasAny">
          <q-item>
            <q-item-section class="text-caption text-grey-6"
              >Searching…</q-item-section
            >
          </q-item>
        </template>
        <template v-else-if="!hasAny">
          <q-item>
            <q-item-section class="text-caption text-grey-6"
              >No matches.</q-item-section
            >
          </q-item>
        </template>
        <template v-else>
          <template v-if="agentMatches.length">
            <q-item-label header>Agents</q-item-label>
            <q-item
              v-for="a in agentMatches"
              :key="`a-${a.agent_id}`"
              v-close-popup
              clickable
              @click="goAgent(a)"
            >
              <q-item-section avatar>
                <q-icon name="computer" size="18px" />
              </q-item-section>
              <q-item-section>
                <q-item-label lines="1">{{ a.hostname }}</q-item-label>
                <q-item-label caption lines="1"
                  >{{ a.client_name }} · {{ a.site_name }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </template>
          <template v-if="clientMatches.length">
            <q-item-label header>Clients</q-item-label>
            <q-item
              v-for="c in clientMatches"
              :key="`c-${c.id}`"
              v-close-popup
              clickable
              @click="goClient(c)"
            >
              <q-item-section avatar>
                <q-icon name="business" size="18px" />
              </q-item-section>
              <q-item-section>
                <q-item-label lines="1">{{ c.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template v-if="siteMatches.length">
            <q-item-label header>Sites</q-item-label>
            <q-item
              v-for="s in siteMatches"
              :key="`s-${s.id}`"
              v-close-popup
              clickable
              @click="goSite(s)"
            >
              <q-item-section avatar>
                <q-icon name="apartment" size="18px" />
              </q-item-section>
              <q-item-section>
                <q-item-label lines="1">{{ s.name }}</q-item-label>
                <q-item-label caption lines="1">{{ s.client_name }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </template>
      </q-list>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useDevicesStore } from "@/stores/devices";
import { useClientsCacheStore } from "@/stores/clientsCache";

const router = useRouter();
const devices = useDevicesStore();
const clientsCache = useClientsCacheStore();

const inputRef = ref<HTMLInputElement | null>(null);
const query = ref("");
const loading = ref(false);
const menuOpen = ref(false);

const hintLabel = computed(() =>
  /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K",
);

const trimmed = computed(() => query.value.trim().toLowerCase());

async function ensureLoaded() {
  if (loading.value) return;
  loading.value = true;
  try {
    const tasks: Promise<unknown>[] = [];
    // useDevicesStore.loadAgents() is the canonical loader; honour its own dedup.
    if (devices.rows.length === 0) tasks.push(devices.loadAgents());
    tasks.push(clientsCache.ensureFresh());
    await Promise.all(tasks);
  } catch {
    /* best-effort — UI shows "No matches." if both are empty */
  } finally {
    loading.value = false;
  }
}

function onFocus() {
  void ensureLoaded();
  if (trimmed.value.length >= 2) menuOpen.value = true;
}

const agentMatches = computed(() => {
  const q = trimmed.value;
  if (q.length < 2) return [];
  return devices.rows
    .filter((r) => (r.hostname || "").toLowerCase().includes(q))
    .slice(0, 5);
});

const clientMatches = computed(() => {
  const q = trimmed.value;
  if (q.length < 2) return [];
  return clientsCache.clients
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 5);
});

const siteMatches = computed(() => {
  const q = trimmed.value;
  if (q.length < 2) return [];
  return clientsCache.sites
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 5);
});

const hasAny = computed(
  () =>
    agentMatches.value.length > 0 ||
    clientMatches.value.length > 0 ||
    siteMatches.value.length > 0,
);

watch(trimmed, (v) => {
  menuOpen.value = v.length >= 2;
});

function goAgent(a: { agent_id: string }) {
  query.value = "";
  menuOpen.value = false;
  inputRef.value?.blur();
  void router.push(`/devices/${a.agent_id}`);
}
// Phase T7: clients and sites now have detail pages — route there directly.
function goClient(c: { id: number | string }) {
  query.value = "";
  menuOpen.value = false;
  inputRef.value?.blur();
  void router.push(`/clients/${c.id}`);
}
function goSite(s: { id: number | string }) {
  query.value = "";
  menuOpen.value = false;
  inputRef.value?.blur();
  void router.push(`/sites/${s.id}`);
}

function clearAndBlur() {
  query.value = "";
  menuOpen.value = false;
  inputRef.value?.blur();
}

function onGlobalKey(ev: KeyboardEvent) {
  if ((ev.metaKey || ev.ctrlKey) && (ev.key === "k" || ev.key === "K")) {
    ev.preventDefault();
    inputRef.value?.focus();
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKey));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKey));
</script>

<style lang="scss" scoped>
.topbar-search {
  display: flex;
  align-items: center;
  gap: var(--intune-space-s);
  background-color: var(--color-bg-surface-2);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  padding: 0 var(--intune-space-m);
  width: min(560px, 40vw);
  height: 32px;
  position: relative;
  transition: border-color var(--intune-duration-fast)
    var(--intune-curve-easy-ease);

  &:focus-within {
    border-color: var(--color-stroke-focus);
    box-shadow: 0 0 0 1px var(--color-stroke-focus);
  }

  &__icon {
    color: var(--color-fg-tertiary);
    flex: none;
  }

  &__input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg-primary);
    font-family: var(--intune-font-family);
    font-size: var(--intune-font-size-300);
    line-height: var(--intune-line-height-300);
    &::placeholder {
      color: var(--color-fg-tertiary);
    }
  }

  &__hint {
    font-size: 11px;
    color: var(--color-fg-tertiary);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    padding: 0 6px;
    line-height: 16px;
    flex: none;
    user-select: none;
  }
}
</style>
