<!-- CoreHealthCard — TRMM version, cert expiry, DB row counts. -->
<template>
  <article class="card" aria-label="TRMM core health">
    <header class="card__head">
      <q-icon name="shield" size="18px" class="card__icon" />
      <h2 class="card__title">TRMM core</h2>
    </header>

    <div v-if="loading" class="card__placeholder">Loading…</div>

    <div v-else-if="health" class="card__body">
      <dl class="card__meta">
        <div>
          <dt>Version</dt>
          <dd>
            {{ health.core.trmm_version }}
            <span v-if="updateAvailable" class="card__pill" data-kind="info">
              update {{ health.core.latest_trmm_ver }} available
            </span>
          </dd>
        </div>
        <div>
          <dt>Latest agent</dt><dd>{{ health.core.latest_agent_ver }}</dd>
        </div>
        <div>
          <dt>Cert</dt>
          <dd>
            <span v-if="certError" class="card__pill" data-kind="warn" :title="certError">
              N/A
            </span>
            <template v-else-if="certDaysRemaining !== null">
              <span
                class="card__pill"
                :data-kind="certTone"
              >
                {{ health.core?.cert?.expired ? "expired" : `${certDaysRemaining}d remaining` }}
              </span>
            </template>
            <span v-else class="card__muted">—</span>
          </dd>
        </div>
      </dl>

      <h3 class="card__subhead">Database</h3>
      <ul class="card__stats">
        <li><span>{{ health.db.agents }}</span> agents</li>
        <li><span>{{ health.db.clients }}</span> clients</li>
        <li><span>{{ health.db.sites }}</span> sites</li>
        <li>
          <router-link to="/alerts">
            <span>{{ health.db.alerts_unresolved }}</span> active alerts
          </router-link>
        </li>
        <li>
          <router-link to="/pending">
            <span>{{ health.db.pending_actions }}</span> pending
          </router-link>
        </li>
        <li>
          <router-link to="/audit?range=1">
            <span>{{ health.db.audit_logs_24h }}</span> audit (24h)
          </router-link>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { DiagnosticsHealth } from "@/api/diagnostics";

const props = defineProps<{
  health: DiagnosticsHealth | null;
  loading: boolean;
}>();

const updateAvailable = computed(() => {
  if (!props.health) return false;
  return (
    props.health.core.latest_trmm_ver &&
    props.health.core.latest_trmm_ver !== props.health.core.trmm_version
  );
});

// Phase T4: defensive optional chaining around `cert` so a short/empty
// cert object from /core/health/ (e.g. when ALLOWED_HOSTS isn't a FQDN
// in dev mode and get_certs() raises IndexError) renders as "N/A" with
// the raw error tucked into a tooltip — no template crash, no ugly
// "list index out of range" string in the page body.
const certError = computed<string | null>(
  () => props.health?.core?.cert?.error ?? null,
);
const certDaysRemaining = computed<number | null>(
  () => props.health?.core?.cert?.days_until_expiry ?? null,
);

const certTone = computed<"warn" | "neg" | "ok">(() => {
  const days = certDaysRemaining.value;
  if (days === null) return "ok";
  if (props.health?.core?.cert?.expired) return "neg";
  if (days < 14) return "warn";
  return "ok";
});
</script>

<style lang="scss" scoped>
@import "./_diag-card";
</style>
