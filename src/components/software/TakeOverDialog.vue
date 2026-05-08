<template>
  <q-dialog v-model="open" persistent @hide="onHide">
    <q-card class="take-over" role="dialog" aria-labelledby="take-over-title">
      <q-card-section class="take-over__header">
        <h2 id="take-over-title" class="take-over__title">
          Take over <span class="take-over__app-name">{{ app.name }}</span>
        </h2>
        <p class="take-over__subtitle">
          {{ app.publisher }} • {{ app.installation_count }} of {{ totalAgents }} machines • {{ app.version_count_distinct }} version{{ app.version_count_distinct === 1 ? "" : "s" }} seen
        </p>
        <q-btn
          flat
          round
          dense
          icon="close"
          aria-label="Close"
          @click="open = false"
        />
      </q-card-section>

      <q-card-section
        v-if="loading"
        class="take-over__loading"
      >
        <q-spinner-dots size="32px" />
        <span class="q-ml-sm">Looking up package candidates…</span>
      </q-card-section>

      <q-card-section v-else-if="error" class="take-over__error">
        Couldn't load candidates: {{ error }}
      </q-card-section>

      <template v-else>
        <q-card-section class="take-over__candidates">
          <div class="take-over__section-title">Pick a package source</div>
          <p
            v-if="candidates.length === 0"
            class="take-over__no-match"
          >
            No matching package found in our catalog. Use "Request review" on the Discovery tab to flag this app for our team.
          </p>
          <q-list v-else separator>
            <q-item
              v-for="c in candidates"
              :key="`${c.source}:${c.package_id}`"
              tag="label"
              clickable
              :class="{ 'take-over__cand--active': isPicked(c) }"
            >
              <q-item-section avatar>
                <q-radio
                  :model-value="picked"
                  :val="candKey(c)"
                  @update:model-value="picked = candKey(c)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="take-over__cand-name">
                  {{ c.display_name }}
                  <q-chip
                    dense
                    :class="`take-over__source-chip take-over__source-chip--${c.source}`"
                  >
                    {{ c.source }}
                  </q-chip>
                </q-item-label>
                <q-item-label caption>
                  {{ c.publisher }} • <code>{{ c.package_id }}</code>
                </q-item-label>
                <q-item-label caption class="take-over__reason">
                  {{ scoreLabel(c) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-section v-if="candidates.length > 0" class="take-over__policy">
          <div class="take-over__section-title">Policy</div>
          <q-toggle
            v-model="autoUpdate"
            label="Auto-update on a daily cadence"
            checked-icon="autorenew"
          />
          <p class="take-over__policy-hint">
            Respects the maintenance window from your WinUpdatePolicy if one is attached. The cadence runs daily checks; updates only ship when a newer version is published in your selected source.
          </p>

          <div class="take-over__reboot-row">
            <span class="take-over__reboot-label">Reboot strategy:</span>
            <q-btn-toggle
              v-model="rebootStrategy"
              dense
              spread
              no-caps
              :options="rebootOptions"
              toggle-color="primary"
              class="take-over__reboot-toggle"
            />
          </div>
        </q-card-section>
      </template>

      <q-card-actions align="right" class="take-over__actions">
        <q-btn flat no-caps label="Cancel" @click="open = false" />
        <q-btn
          v-if="candidates.length > 0"
          unelevated
          no-caps
          color="primary"
          label="Confirm take over"
          icon-right="arrow_forward"
          :loading="submitting"
          :disable="!picked"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";

import {
  getAppCandidates,
  takeOverApp as takeOverAppApi,
  type InstalledAppDetail,
  type InstalledAppListRow,
  type PackageCandidate,
} from "@/api/softwareInventory";

const props = defineProps<{
  app: InstalledAppListRow;
  totalAgents: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "taken-over", detail: InstalledAppDetail): void;
}>();

const $q = useQuasar();

const open = ref(true);
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);
const candidates = ref<PackageCandidate[]>([]);
const picked = ref<string | null>(null);

const autoUpdate = ref(true);
const rebootStrategy = ref<"defer" | "prompt" | "force">("defer");

const rebootOptions = [
  { label: "Defer", value: "defer" },
  { label: "Prompt user", value: "prompt" },
  { label: "Force", value: "force" },
];

function candKey(c: PackageCandidate) {
  return `${c.source}:${c.package_id}`;
}

function isPicked(c: PackageCandidate) {
  return picked.value === candKey(c);
}

function scoreLabel(c: PackageCandidate) {
  if (c.reason === "exact-identity") return `Exact match • ${(c.score * 100).toFixed(0)}% confidence`;
  if (c.reason === "name-exact-publisher-missing")
    return `Name match (publisher omitted) • ${(c.score * 100).toFixed(0)}% confidence`;
  if (c.reason.startsWith("publisher-anchor"))
    return `Same publisher, fuzzy name match • ${(c.score * 100).toFixed(0)}% confidence`;
  return `Fuzzy match • ${(c.score * 100).toFixed(0)}% confidence`;
}

const pickedCandidate = computed<PackageCandidate | null>(() => {
  if (!picked.value) return null;
  return candidates.value.find((c) => candKey(c) === picked.value) ?? null;
});

async function load() {
  try {
    loading.value = true;
    const r = await getAppCandidates(props.app.id);
    candidates.value = r.candidates;
    // Auto-pick the top candidate (matching choco preference if tied).
    if (r.candidates.length > 0) {
      const best = [...r.candidates].sort(
        (a, b) =>
          b.score - a.score ||
          (a.source === "choco" ? -1 : 1) - (b.source === "choco" ? -1 : 1),
      )[0];
      picked.value = candKey(best);
    }
  } catch (e) {
    error.value = (e as Error).message ?? String(e);
  } finally {
    loading.value = false;
  }
}

async function confirm() {
  if (!pickedCandidate.value) return;
  submitting.value = true;
  try {
    const detail = await takeOverAppApi(props.app.id, {
      source: pickedCandidate.value.source,
      package_id: pickedCandidate.value.package_id,
      display_name: pickedCandidate.value.display_name,
      publisher: pickedCandidate.value.publisher,
      policy: {
        auto_update_enabled: autoUpdate.value,
        reboot_required_strategy: rebootStrategy.value,
        maintenance_window_id: null,
      },
    });
    emit("taken-over", detail);
  } catch (e) {
    $q.notify({
      type: "negative",
      message: `Take over failed: ${(e as Error).message}`,
      timeout: 5000,
    });
  } finally {
    submitting.value = false;
  }
}

function onHide() {
  emit("close");
}

onMounted(load);
</script>

<style lang="scss" scoped>
.take-over {
  width: 580px;
  max-width: 90vw;
  background-color: var(--color-bg-surface);
  color: var(--color-fg-primary);
  border-radius: var(--intune-radius-large);

  &__header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--intune-space-m);
    align-items: start;
    padding-bottom: var(--intune-space-s);

    & > .q-btn { grid-column: 2; grid-row: 1 / span 2; align-self: start; }
  }
  &__title {
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0;
    line-height: 1.2;
    color: var(--color-fg-primary);
  }
  &__app-name { color: var(--color-brand-rest); }
  &__subtitle {
    grid-column: 1;
    color: var(--color-fg-secondary);
    margin: var(--intune-space-xs) 0 0;
    font-size: var(--intune-font-size-300);
  }

  &__loading,
  &__error {
    display: flex;
    align-items: center;
    color: var(--color-fg-secondary);
    padding: var(--intune-space-xl);
  }
  &__error { color: var(--intune-status-danger); }

  &__section-title {
    font-size: var(--intune-font-size-200);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-tertiary);
    margin-bottom: var(--intune-space-s);
  }

  &__candidates {
    padding-top: 0;
  }

  &__no-match {
    color: var(--color-fg-secondary);
    font-style: italic;
    margin: 0;
  }

  &__cand--active {
    background-color: var(--color-brand-bg-rest);
  }
  &__cand-name {
    display: flex;
    align-items: center;
    gap: var(--intune-space-s);
    font-weight: var(--intune-font-weight-medium);
  }
  &__source-chip {
    text-transform: uppercase;
    font-size: 10px;
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: 0.4px;
    padding: 0 8px;

    &--choco { background: #80c5e3; color: #053b59; }
  }
  &__reason {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
  }

  &__policy {
    border-top: 1px solid var(--color-stroke-divider);
    padding-top: var(--intune-space-l);
  }
  &__policy-hint {
    color: var(--color-fg-tertiary);
    font-size: var(--intune-font-size-200);
    margin: var(--intune-space-xs) 0 var(--intune-space-m) 28px;
  }
  &__reboot-row {
    display: flex;
    align-items: center;
    gap: var(--intune-space-m);
    margin-top: var(--intune-space-m);
  }
  &__reboot-label {
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-300);
  }
  &__reboot-toggle {
    flex: 1;
  }

  &__actions {
    border-top: 1px solid var(--color-stroke-divider);
    padding: var(--intune-space-m) var(--intune-space-l);
  }
}
</style>
