<!--
  DevicesTable — q-table skinned to look like Intune.
  Reads filtered/sorted rows from the devices store, owns selection,
  emits open-detail on row activation.
-->
<template>
  <div :class="`dtbl dtbl--${density}`">
    <q-table
      :rows="store.filteredRows"
      :columns="qColumns"
      row-key="agent_id"
      :visible-columns="store.visibleColumns"
      :pagination="pagination"
      @update:pagination="onPagination"
      :rows-per-page-options="[25, 50, 100, 200, 0]"
      :loading="store.loading"
      :selected="selectedProxy"
      @update:selected="onSelected"
      selection="multiple"
      binary-state-sort
      virtual-scroll
      :virtual-scroll-sticky-size-start="48"
      flat
      square
      table-class="dtbl__table"
      table-header-class="dtbl__head"
      class="dtbl__q"
      no-data-label="No agents match your filters."
    >
      <!-- Header: status (icon-only) -->
      <template v-slot:header-cell-status="props">
        <q-th :props="props" auto-width>
          <q-icon name="signal_cellular_alt" size="18px">
            <q-tooltip>Status</q-tooltip>
          </q-icon>
        </q-th>
      </template>

      <!-- Status cell: chip with online/offline/overdue + failing checks badge -->
      <template v-slot:body-cell-status="props">
        <q-td :props="props" auto-width>
          <StatusChip
            :tone="statusTone(props.row)"
            :label="statusLabel(props.row)"
            :title="statusTitle(props.row)"
          />
        </q-td>
      </template>

      <!-- Hostname: clickable, opens drawer -->
      <template v-slot:body-cell-hostname="props">
        <q-td :props="props">
          <a
            class="dtbl__hostname"
            href="#"
            @click.prevent="$emit('open-detail', props.row)"
          >{{ props.row.hostname }}</a>
        </q-td>
      </template>

      <!-- Type pill -->
      <template v-slot:body-cell-monitoring_type="props">
        <q-td :props="props">
          <span class="dtbl__type-pill">
            <q-icon
              :name="props.row.monitoring_type === 'server' ? 'dns' : 'computer'"
              size="14px"
            />
            {{ props.row.monitoring_type }}
          </span>
        </q-td>
      </template>

      <!-- Reboot icon -->
      <template v-slot:body-cell-needs_reboot="props">
        <q-td :props="props" class="text-center">
          <q-icon
            v-if="props.row.needs_reboot"
            name="restart_alt"
            color="primary"
            size="18px"
          >
            <q-tooltip>Reboot required</q-tooltip>
          </q-icon>
        </q-td>
      </template>

      <!-- Last seen: relative -->
      <template v-slot:body-cell-last_seen="props">
        <q-td :props="props">
          <span :title="props.row.last_seen || ''">{{ relTime(props.row.last_seen) }}</span>
        </q-td>
      </template>

      <!-- Inline-edit description -->
      <template v-slot:body-cell-description="props">
        <q-td :props="props">
          <InlineEditCell
            :value="props.row.description ?? ''"
            placeholder="—"
            @save="(val) => onEditDescription(props.row, val)"
          />
        </q-td>
      </template>

      <!-- Checks failing count -->
      <template v-slot:body-cell-checks_failing="props">
        <q-td :props="props" class="text-right">
          <span
            v-if="(props.row.checks?.failing ?? 0) > 0"
            class="dtbl__checks-fail"
          >{{ props.row.checks.failing }}</span>
          <span v-else class="dtbl__checks-ok">{{ props.row.checks?.passing ?? 0 }}</span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { date } from "quasar";

import { useDevicesStore } from "@/stores/devices";
import { patchAgent, type AgentRow } from "@/api/devices";
import { QTABLE_COLUMNS } from "@/components/devices/columns";

import StatusChip from "@/components/devices/StatusChip.vue";
import InlineEditCell from "@/components/devices/InlineEditCell.vue";

defineEmits<{
  (e: "open-detail", row: AgentRow): void;
}>();

const store = useDevicesStore();
const qColumns = QTABLE_COLUMNS;
const density = computed(() => store.density);

// q-table pagination object — we keep it shallow-stable; sorting fires here.
const pagination = computed({
  get: () => ({
    sortBy: store.sort.by as string,
    descending: store.sort.desc,
    page: store.page,
    rowsPerPage: store.rowsPerPage,
  }),
  set: (v: { sortBy: string; descending: boolean; page: number; rowsPerPage: number }) => {
    store.setSort(v.sortBy as never, v.descending);
    store.page = v.page;
    store.rowsPerPage = v.rowsPerPage;
  },
});
function onPagination(v: { sortBy: string; descending: boolean; page: number; rowsPerPage: number }) {
  pagination.value = v;
}

// q-table emits arrays of rows for selection — we mirror to the store.
const selectedProxy = computed({
  get: () => store.selected,
  set: (v: AgentRow[]) => (store.selected = v),
});
function onSelected(v: AgentRow[]) {
  store.selected = v;
}

// ── Status helpers ──────────────────────────────────────────────────────────
function statusTone(r: AgentRow): "positive" | "warning" | "negative" | "neutral" {
  if (r.status === "overdue") return "negative";
  if (r.status === "offline") return "warning";
  if (r.checks?.has_failing_checks) return "negative";
  if (r.has_patches_pending || r.needs_reboot) return "warning";
  if (r.status === "online") return "positive";
  return "neutral";
}
function statusLabel(r: AgentRow): string {
  if (r.status === "overdue") return "Overdue";
  if (r.status === "offline") return "Offline";
  if (r.checks?.has_failing_checks) return `${r.checks.failing} failing`;
  if (r.needs_reboot) return "Reboot pending";
  if (r.has_patches_pending) return "Patches pending";
  if (r.status === "online") return "Online";
  return r.status;
}
function statusTitle(r: AgentRow): string {
  const parts: string[] = [`Status: ${r.status}`];
  if (r.checks?.failing) parts.push(`${r.checks.failing} failing checks`);
  if (r.needs_reboot) parts.push("reboot required");
  if (r.has_patches_pending) parts.push("patches pending");
  return parts.join(" · ");
}

// ── Time helper ──
function relTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return date.formatDate(d, "YYYY-MM-DD");
}

// ── Inline edit description ──
async function onEditDescription(row: AgentRow, value: string) {
  const prev = row.description ?? "";
  if (value === prev) return;
  // optimistic
  store.patchRow(row.agent_id, { description: value });
  try {
    await patchAgent(row.agent_id, { description: value });
  } catch (e) {
    // revert on error
    store.patchRow(row.agent_id, { description: prev });
    // surface as Quasar notify via window.$q if available, else console
    // (kept local — page-level notify is the right home, but a simple
    //  console.warn keeps this component dependency-free)
    console.warn("Failed to save description", e);
  }
}
</script>

<style lang="scss" scoped>
// Density tokens map to row + cell padding only — Quasar's --comfortable etc.
// scope is too aggressive, we want a measured Intune-style density step.
.dtbl {
  --row-pad-y: 8px;
  --row-pad-x: 12px;
  --row-font: var(--intune-font-size-200);

  background: var(--color-bg-surface);
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  overflow: hidden;

  &--comfortable { --row-pad-y: 14px; --row-font: var(--intune-font-size-300); }
  &--cozy        { --row-pad-y: 8px;  --row-font: var(--intune-font-size-200); }
  &--compact     { --row-pad-y: 4px;  --row-font: var(--intune-font-size-100); }

  :deep(.dtbl__table) {
    background: transparent;
  }
  :deep(.dtbl__head th) {
    background: var(--color-bg-elevated, rgba(0,0,0,0.02));
    color: var(--color-fg-secondary);
    font-weight: var(--intune-font-weight-semibold);
    font-size: var(--intune-font-size-100);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    height: 36px;
    padding-top: 0;
    padding-bottom: 0;
    border-bottom: 1px solid var(--color-stroke-divider);
  }
  :deep(.q-table tbody td) {
    padding-top: var(--row-pad-y);
    padding-bottom: var(--row-pad-y);
    padding-left: var(--row-pad-x);
    padding-right: var(--row-pad-x);
    font-size: var(--row-font);
    color: var(--color-fg-primary);
    border-bottom: 1px solid var(--color-stroke-divider);
  }
  :deep(.q-table tbody tr:hover td) {
    background: var(--color-bg-elevated, rgba(0, 120, 212, 0.04));
  }
  :deep(.q-table tbody tr.selected td) {
    background: rgba(0, 120, 212, 0.10);
  }
  :deep(.q-checkbox__inner) {
    color: var(--color-fg-tertiary);
  }

  &__hostname {
    color: var(--color-brand-rest, #0078d4);
    text-decoration: none;
    font-weight: var(--intune-font-weight-medium);
    &:hover { text-decoration: underline; }
  }
  &__type-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--color-bg-elevated, rgba(0,0,0,0.04));
    border: 1px solid var(--color-stroke-divider);
    font-size: var(--intune-font-size-100);
    text-transform: capitalize;
  }
  &__checks-fail {
    color: var(--color-status-negative-fg, #c50f1f);
    font-weight: var(--intune-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }
  &__checks-ok {
    color: var(--color-fg-tertiary);
    font-variant-numeric: tabular-nums;
  }
}
</style>
