<template>
  <q-card flat bordered class="apps-card review-queue">
    <q-card-section class="apps-card__filters">
      <q-btn-toggle
        v-model="statusFilter"
        dense
        no-caps
        :options="statusOptions"
        toggle-color="primary"
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        size="sm"
        icon="refresh"
        label="Refresh"
        @click="load"
        :disable="loading"
      />
    </q-card-section>

    <q-list separator>
      <q-item v-for="r in reviews" :key="r.id" class="review-row">
        <q-item-section class="review-row__app">
          <q-item-label class="review-row__name">{{ r.app.name }}</q-item-label>
          <q-item-label caption>
            {{ r.app.publisher || "(unknown publisher)" }}
            · {{ r.app.installation_count }} machine{{ r.app.installation_count === 1 ? "" : "s" }}
          </q-item-label>
          <q-item-label caption class="review-row__meta">
            requested by {{ r.requested_by || "system" }} · {{ formatRelative(r.requested_at) }}
          </q-item-label>
        </q-item-section>

        <q-item-section v-if="r.status !== 'pending'" class="review-row__resolved">
          <q-chip
            dense
            outline
            :class="`pkg-chip pkg-chip--${r.status === 'matched' ? 'matched' : 'ignored'}`"
          >
            <q-icon
              :name="r.status === 'matched' ? 'check_circle' : 'visibility_off'"
              size="14px"
              class="q-mr-xs"
            />
            {{ r.status === 'matched'
                ? `${r.resolved_match?.source}: ${r.resolved_match?.package_id}`
                : 'ignored' }}
          </q-chip>
          <q-item-label caption>
            {{ r.resolved_by || "—" }} · {{ r.resolved_at ? formatRelative(r.resolved_at) : "" }}
          </q-item-label>
        </q-item-section>

        <q-item-section v-else class="review-row__form">
          <q-select
            v-model="rowState[r.id].pickedDef"
            :options="catalogOptions"
            dense
            outlined
            use-input
            emit-value
            map-options
            option-label="label"
            option-value="key"
            input-debounce="200"
            label="Pick a Choco/WinGet package"
            class="review-row__select"
            @filter="filterCatalog"
          />
        </q-item-section>

        <q-item-section v-if="r.status === 'pending'" side class="review-row__actions">
          <div class="review-row__buttons">
            <q-btn
              unelevated
              no-caps
              size="sm"
              color="primary"
              icon-right="check"
              label="Match"
              :disable="!rowState[r.id].pickedDef || busyId === r.id"
              :loading="busyId === r.id && busyOp === 'match'"
              @click="onMatch(r)"
            />
            <q-btn
              flat
              no-caps
              size="sm"
              icon-right="visibility_off"
              label="Ignore"
              :disable="busyId === r.id"
              :loading="busyId === r.id && busyOp === 'ignore'"
              @click="onIgnore(r)"
            />
          </div>
        </q-item-section>
      </q-item>

      <q-item v-if="!loading && reviews.length === 0" class="review-queue__empty">
        <q-item-section>
          <q-item-label class="text-caption">
            <span v-if="statusFilter === 'pending'">No pending review requests. </span>
            <span v-else>No {{ statusFilter }} reviews to show.</span>
            Apps without a Choco/WinGet match show up here when an admin
            clicks "Request review" on Discovery.
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useQuasar } from "quasar";

import {
  listCatalog,
  listReviews,
  resolveReviewIgnore,
  resolveReviewMatch,
  type CatalogPackage,
  type ReviewRow,
} from "@/api/softwareInventory";

const emit = defineEmits<{ (e: "resolved", row: ReviewRow): void }>();
const $q = useQuasar();

const reviews = ref<ReviewRow[]>([]);
const loading = ref(false);
const statusFilter = ref<"pending" | "matched" | "ignored" | "all">("pending");
const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Matched", value: "matched" },
  { label: "Ignored", value: "ignored" },
  { label: "All", value: "all" },
];

const busyId = ref<number | null>(null);
const busyOp = ref<"match" | "ignore" | null>(null);

interface CatalogOption { key: string; label: string; row: CatalogPackage }
const catalog = ref<CatalogPackage[]>([]);
const catalogOptions = ref<CatalogOption[]>([]);

interface RowFormState { pickedDef: string | null }
const rowState = reactive<Record<number, RowFormState>>({});

async function loadCatalog() {
  try {
    const r = await listCatalog();
    catalog.value = r.results;
    catalogOptions.value = r.results.map((c) => ({
      key: `${c.source}:${c.package_id}`,
      label: `${c.display_name} (${c.source}: ${c.package_id})`,
      row: c,
    }));
  } catch (e) {
    $q.notify({ type: "negative", message: `Catalog load failed: ${(e as Error).message}` });
  }
}

function filterCatalog(needle: string, update: (cb: () => void) => void) {
  update(() => {
    const q = needle.toLowerCase();
    if (!q) {
      catalogOptions.value = catalog.value.slice(0, 50).map((c) => ({
        key: `${c.source}:${c.package_id}`,
        label: `${c.display_name} (${c.source}: ${c.package_id})`,
        row: c,
      }));
      return;
    }
    catalogOptions.value = catalog.value
      .filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          c.publisher.toLowerCase().includes(q) ||
          c.package_id.toLowerCase().includes(q),
      )
      .slice(0, 100)
      .map((c) => ({
        key: `${c.source}:${c.package_id}`,
        label: `${c.display_name} (${c.source}: ${c.package_id})`,
        row: c,
      }));
  });
}

async function load() {
  loading.value = true;
  try {
    const r = await listReviews(statusFilter.value);
    reviews.value = r.results;
    for (const review of r.results) {
      if (!(review.id in rowState)) {
        rowState[review.id] = { pickedDef: null };
      }
    }
  } catch (e) {
    $q.notify({ type: "negative", message: `Review queue load failed: ${(e as Error).message}` });
  } finally {
    loading.value = false;
  }
}

async function onMatch(row: ReviewRow) {
  const key = rowState[row.id].pickedDef;
  if (!key) return;
  const opt = catalogOptions.value.find((o) => o.key === key);
  if (!opt) return;
  busyId.value = row.id;
  busyOp.value = "match";
  try {
    await resolveReviewMatch(row.id, {
      source: opt.row.source as "choco" | "winget",
      package_id: opt.row.package_id,
      display_name: opt.row.display_name,
      publisher: opt.row.publisher,
    });
    $q.notify({
      type: "positive",
      message: `Matched ${row.app.name} → ${opt.row.source}: ${opt.row.package_id}`,
      timeout: 4000,
    });
    emit("resolved", row);
    await load();
  } catch (e) {
    $q.notify({ type: "negative", message: `Match failed: ${(e as Error).message}` });
  } finally {
    busyId.value = null;
    busyOp.value = null;
  }
}

async function onIgnore(row: ReviewRow) {
  busyId.value = row.id;
  busyOp.value = "ignore";
  try {
    await resolveReviewIgnore(row.id);
    $q.notify({ type: "positive", message: `Ignored ${row.app.name}`, timeout: 3000 });
    emit("resolved", row);
    await load();
  } catch (e) {
    $q.notify({ type: "negative", message: `Ignore failed: ${(e as Error).message}` });
  } finally {
    busyId.value = null;
    busyOp.value = null;
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

onMounted(async () => {
  await loadCatalog();
  await load();
});

watch(statusFilter, load);
</script>

<style lang="scss" scoped>
.review-queue {
  &__empty { color: var(--color-fg-tertiary); }
}
.review-row {
  align-items: flex-start;
  gap: var(--intune-space-m);
  padding: var(--intune-space-m) var(--intune-space-l);

  &__name {
    font-weight: var(--intune-font-weight-medium);
  }
  &__meta {
    color: var(--color-fg-tertiary);
    margin-top: 2px;
  }
  &__select { min-width: 320px; }
  &__buttons {
    display: flex;
    gap: var(--intune-space-s);
  }
}
.pkg-chip {
  font-size: var(--intune-font-size-200);
  &--matched { color: var(--intune-status-success); border-color: var(--intune-status-success); }
  &--ignored { color: var(--color-fg-tertiary); border-color: var(--color-stroke-divider); }
}
</style>
