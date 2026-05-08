<!--
  ServicesHealthCard — port probes (Redis/NATS/Mesh), Celery queue, and
  the systemd service map. systemd values are nullable inside the docker
  dev image; we render those as "N/A" rather than crashing.
-->
<template>
  <article class="card" aria-label="Services and probes">
    <header class="card__head">
      <q-icon name="dns" size="18px" class="card__icon" />
      <h2 class="card__title">Services &amp; probes</h2>
    </header>

    <div v-if="loading" class="card__placeholder">Loading…</div>

    <div v-else-if="health" class="card__body">
      <h3 class="card__subhead">Probes</h3>
      <div class="card__row">
        <span class="card__row-name">Redis</span>
        <span class="card__pill" :data-kind="health.probes.redis_ping ? 'ok' : 'neg'">
          {{ health.probes.redis_ping ? "ok" : "down" }}
        </span>
      </div>
      <div class="card__row">
        <span class="card__row-name">NATS (std)</span>
        <span class="card__pill" :data-kind="health.probes.nats_std ? 'ok' : 'neg'">
          {{ health.probes.nats_std ? "ok" : "down" }}
        </span>
      </div>
      <div class="card__row">
        <span class="card__row-name">NATS (ws)</span>
        <span class="card__pill" :data-kind="health.probes.nats_ws ? 'ok' : 'neg'">
          {{ health.probes.nats_ws ? "ok" : "down" }}
        </span>
      </div>
      <div class="card__row">
        <span class="card__row-name">MeshCentral</span>
        <span class="card__pill" :data-kind="health.probes.mesh ? 'ok' : 'neg'">
          {{ health.probes.mesh ? "ok" : "down" }}
        </span>
      </div>

      <h3 class="card__subhead">Celery</h3>
      <div class="card__row">
        <span class="card__row-name">Queue length</span>
        <span class="card__row-value">{{ health.celery.queue_len }}</span>
      </div>
      <div class="card__row">
        <span class="card__row-name">Queue health</span>
        <span class="card__pill" :data-kind="health.celery.health === 'healthy' ? 'ok' : 'neg'">
          {{ health.celery.health }}
        </span>
      </div>

      <h3 class="card__subhead">Systemd services</h3>
      <div
        v-for="[name, state] in serviceEntries"
        :key="name"
        class="card__row"
      >
        <span class="card__row-name">{{ name }}</span>
        <span
          class="card__pill"
          :data-kind="state === null ? '' : state ? 'ok' : 'neg'"
        >
          {{ state === null ? "N/A" : state ? "running" : "stopped" }}
        </span>
      </div>
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

const serviceEntries = computed<Array<[string, boolean | null]>>(() => {
  if (!props.health) return [];
  return Object.entries(props.health.services) as Array<[string, boolean | null]>;
});
</script>

<style lang="scss" scoped>
@import "./_diag-card";
</style>
