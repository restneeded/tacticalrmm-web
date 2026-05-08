<!--
  AutomationTab — read-only view of the policies applied to one agent.

  Source: the agent payload itself returns `applied_policies` from
  AgentSerializer.get_applied_policies() — a dict keyed by source
  (agent_policy / site_policy / client_policy / default_policy) with
  the resolved Policy serialized inline (or null if not applied).

  We pull the full agent object once for this tab rather than enriching
  the live composable for one tab. Phase O builds the full editor; this
  tab just surfaces what's effective today.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <div class="ad-tab__hint">
        Read-only for Phase J. Policy editor lands in Phase O.
      </div>
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

    <div v-if="loading && !appliedPolicies" class="state">Loading policies…</div>
    <div v-else-if="errorMsg" class="state state--error">
      Couldn't load policies: {{ errorMsg }}
    </div>
    <div v-else-if="visibleSources.length === 0" class="state">
      No automation policies are currently applied to this agent.
    </div>
    <div v-else class="stack">
      <article
        v-for="src in visibleSources"
        :key="src.key"
        class="card"
        :class="{ 'card--inactive': !src.policy }"
      >
        <header class="card__head">
          <div>
            <div class="card__source">{{ src.label }}</div>
            <h3 class="card__name">
              {{ src.policy?.name || "—" }}
            </h3>
          </div>
          <span
            class="badge"
            :class="src.policy?.active ? 'badge--ok' : 'badge--neutral'"
          >
            {{ src.policy?.active ? "active" : "inactive" }}
          </span>
        </header>

        <div v-if="src.policy" class="card__grid">
          <div>
            <dt>Enforced</dt>
            <dd>{{ src.policy.enforced ? "Yes" : "No" }}</dd>
          </div>
          <div>
            <dt>Block inheritance</dt>
            <dd>{{ src.policy.block_inheritance ? "Yes" : "No" }}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{{ src.policy.desc || "—" }}</dd>
          </div>
        </div>

        <div v-if="src.policy" class="card__counts">
          <span class="count">
            <strong>{{ taskCount(src.policy) }}</strong>
            <span>tasks</span>
          </span>
          <span class="count">
            <strong>{{ checkCount(src.policy) }}</strong>
            <span>checks</span>
          </span>
        </div>

        <div v-else class="card__empty">
          No {{ src.label.toLowerCase() }} applies to this agent.
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { fetchAgent } from "@/api/agents";

interface PolicyShape {
  id: number;
  name: string;
  desc: string | null;
  active: boolean;
  enforced: boolean;
  block_inheritance: boolean;
  autotasks?: unknown[];
  policychecks?: unknown[];
}

interface AppliedPolicies {
  agent_policy: PolicyShape | null;
  site_policy: PolicyShape | null;
  client_policy: PolicyShape | null;
  default_policy: PolicyShape | null;
}

interface AgentPayload {
  applied_policies?: AppliedPolicies;
}

const props = defineProps<{
  agentId: string;
  status: { hostname: string | null } | null;
}>();

const appliedPolicies = ref<AppliedPolicies | null>(null);
const loading = ref(true);
const errorMsg = ref("");

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = (await fetchAgent(props.agentId)) as AgentPayload | undefined;
    appliedPolicies.value = data?.applied_policies ?? null;
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

const SOURCES: Array<{ key: keyof AppliedPolicies; label: string }> = [
  { key: "agent_policy",   label: "Agent override" },
  { key: "site_policy",    label: "Site policy" },
  { key: "client_policy",  label: "Client policy" },
  { key: "default_policy", label: "Default policy" },
];

const visibleSources = computed(() =>
  SOURCES.map((s) => ({
    ...s,
    policy: appliedPolicies.value?.[s.key] ?? null,
  })).filter((s) => s.policy || appliedPolicies.value),
);

function taskCount(p: PolicyShape): number {
  return Array.isArray(p.autotasks) ? p.autotasks.length : 0;
}
function checkCount(p: PolicyShape): number {
  return Array.isArray(p.policychecks) ? p.policychecks.length : 0;
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
  &__hint {
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;
  &--error { color: var(--color-state-negative-fg, #a40e26); }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 14px 16px;

  &--inactive {
    opacity: 0.55;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 8px;
  }
  &__source {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-secondary);
    font-weight: 600;
    margin-bottom: 2px;
  }
  &__name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 6px 16px;
    font-size: 13px;
    margin-bottom: 8px;

    div { display: contents; }
    dt { color: var(--color-fg-secondary); margin: 0; }
    dd { margin: 0; word-break: break-word; }
  }
  &__counts {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--color-fg-secondary);
  }
  &__empty {
    font-size: 13px;
    color: var(--color-fg-secondary);
    padding: 4px 0;
  }
}

.count {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  strong {
    color: var(--color-fg-primary);
    font-size: 14px;
  }
}

.badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 999px;
  padding: 2px 8px;

  &--ok {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
  }
  &--neutral {
    background: var(--color-bg-page);
    color: var(--color-fg-secondary);
  }
}
</style>
