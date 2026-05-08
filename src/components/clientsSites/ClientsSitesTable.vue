<!--
  Phase I — Clients & Sites table.
  - Default: one row per Site.
  - Group-by-Client toggle: one row per Client (no per-site rows; aggregated).
  - Reuses Phase C skinning conventions (density, header style, hover, etc.).

  Phase T3 — every row fires `row-context` on right-click. The page renders
  a single shared <RowContextMenu> positioned at the click point — q-menu
  cannot legally live inside a <tr>, so we lift the menu up to the page.
-->
<template>
  <div :class="`cstbl cstbl--${density}`">
    <!-- Site rows (default) -->
    <q-table
      v-if="!store.groupByClient"
      :rows="store.filteredRows"
      :columns="qColumns"
      row-key="site_id"
      :visible-columns="store.visibleColumns"
      :pagination="pagination"
      @update:pagination="onPagination"
      :rows-per-page-options="[25, 50, 100, 200, 0]"
      :loading="store.loading"
      :selected="selectedProxy"
      @update:selected="onSelected"
      @row-dblclick="(_e: unknown, row: SiteRow) => emit('open-detail', row)"
      selection="multiple"
      binary-state-sort
      virtual-scroll
      :virtual-scroll-sticky-size-start="48"
      flat
      square
      table-class="cstbl__table"
      table-header-class="cstbl__head"
      class="cstbl__q"
      no-data-label="No clients or sites match your filters."
    >
      <template v-slot:body="props">
        <q-tr
          :props="props"
          class="cstbl__row"
          @contextmenu.prevent="(e: MouseEvent) => onContext('site', props.row, e)"
        >
          <q-td auto-width>
            <q-checkbox v-model="props.selected" />
          </q-td>
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            <template v-if="col.name === 'client_name'">
              <a
                class="cstbl__link"
                href="#"
                @click.prevent="$emit('open-client', props.row)"
              >{{ props.row.client_name }}</a>
            </template>
            <template v-else-if="col.name === 'site_name'">
              <InlineEditCell
                :value="props.row.site_name"
                placeholder="(unnamed)"
                @save="(val) => onEditSiteName(props.row, val)"
              />
            </template>
            <template v-else-if="col.name === 'workstations'">
              <CountBar :online="props.row.workstations_online" :total="props.row.workstations_total" tone="primary" />
            </template>
            <template v-else-if="col.name === 'servers'">
              <CountBar :online="props.row.servers_online" :total="props.row.servers_total" tone="brand" />
            </template>
            <template v-else-if="col.name === 'agent_count'">
              <span class="cstbl__num">{{ props.row.agent_count }}</span>
            </template>
            <template v-else-if="col.name === 'failing_checks'">
              <span v-if="props.row.failing_checks > 0" class="cstbl__fail">{{ props.row.failing_checks }}</span>
              <span v-else class="cstbl__zero">0</span>
            </template>
            <template v-else-if="col.name === 'patches_pending'">
              <span v-if="props.row.patches_pending > 0" class="cstbl__warn">{{ props.row.patches_pending }}</span>
              <span v-else class="cstbl__zero">0</span>
            </template>
            <template v-else-if="col.name === 'last_seen'">
              <span :title="props.row.last_seen || ''">{{ relTime(props.row.last_seen) }}</span>
            </template>
            <template v-else-if="col.name === 'maintenance_mode'">
              <q-icon
                v-if="props.row.maintenance_mode"
                name="build"
                color="warning"
                size="18px"
              >
                <q-tooltip>Maintenance mode on at least one agent</q-tooltip>
              </q-icon>
            </template>
            <template v-else>{{ col.value }}</template>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Grouped rows (one per client) -->
    <q-table
      v-else
      :rows="store.groupedRows"
      :columns="groupedColumns"
      row-key="client_id"
      :pagination="pagination"
      @update:pagination="onPagination"
      :rows-per-page-options="[25, 50, 100, 200, 0]"
      :loading="store.loading"
      binary-state-sort
      virtual-scroll
      flat
      square
      table-class="cstbl__table"
      table-header-class="cstbl__head"
      class="cstbl__q"
      no-data-label="No clients match your filters."
    >
      <template v-slot:body="props">
        <q-tr
          :props="props"
          class="cstbl__row"
          @contextmenu.prevent="(e: MouseEvent) => onContext('client', props.row, e)"
        >
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            <template v-if="col.name === 'client_name'">
              <a
                class="cstbl__link"
                href="#"
                @click.prevent="$emit('open-client-by-id', props.row.client_id)"
              >{{ props.row.client_name }}</a>
            </template>
            <template v-else-if="col.name === 'site_count'">
              <span class="cstbl__num">{{ props.row.site_count }}</span>
            </template>
            <template v-else-if="col.name === 'workstations'">
              <CountBar :online="props.row.workstations_online" :total="props.row.workstations_total" tone="primary" />
            </template>
            <template v-else-if="col.name === 'servers'">
              <CountBar :online="props.row.servers_online" :total="props.row.servers_total" tone="brand" />
            </template>
            <template v-else-if="col.name === 'agent_count'">
              <span class="cstbl__num">{{ props.row.agent_count }}</span>
            </template>
            <template v-else-if="col.name === 'failing_checks'">
              <span v-if="props.row.failing_checks > 0" class="cstbl__fail">{{ props.row.failing_checks }}</span>
              <span v-else class="cstbl__zero">0</span>
            </template>
            <template v-else-if="col.name === 'last_seen'">
              <span :title="props.row.last_seen || ''">{{ relTime(props.row.last_seen) }}</span>
            </template>
            <template v-else>{{ col.value }}</template>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { date } from "quasar";

import { useClientsSitesStore } from "@/stores/clientsSites";
import { editSite } from "@/api/clients";
import { QTABLE_COLUMNS } from "@/components/clientsSites/columns";
import type { SiteRow } from "@/components/clientsSites/columns";
import type { GroupedClientRow } from "@/stores/clientsSites";

import InlineEditCell from "@/components/devices/InlineEditCell.vue";
import CountBar from "@/components/clientsSites/CountBar.vue";

const emit = defineEmits<{
  (e: "open-detail", row: SiteRow): void;
  (e: "open-client", row: SiteRow): void;
  (e: "open-client-by-id", id: number): void;
  (e: "row-context", payload: {
    scope: "client" | "site";
    row: SiteRow | GroupedClientRow;
    clientX: number;
    clientY: number;
  }): void;
}>();

const store = useClientsSitesStore();
const qColumns = QTABLE_COLUMNS;
const density = computed(() => store.density);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const groupedColumns: any[] = [
  { name: "client_name",      label: "Client",          field: "client_name",        sortable: true, align: "left"  },
  { name: "site_count",       label: "Sites",           field: "site_count",         sortable: true, align: "right" },
  { name: "workstations",     label: "Workstations",    field: "workstations_total", sortable: true, align: "left"  },
  { name: "servers",          label: "Servers",         field: "servers_total",      sortable: true, align: "left"  },
  { name: "agent_count",      label: "Total agents",    field: "agent_count",        sortable: true, align: "right" },
  { name: "failing_checks",   label: "Failing checks",  field: "failing_checks",     sortable: true, align: "right" },
  { name: "last_seen",        label: "Last check-in",   field: "last_seen",          sortable: true, align: "left"  },
];

const pagination = computed({
  get: () => ({
    sortBy: store.sort.by,
    descending: store.sort.desc,
    page: store.page,
    rowsPerPage: store.rowsPerPage,
  }),
  set: (v: { sortBy: string; descending: boolean; page: number; rowsPerPage: number }) => {
    store.setSort(v.sortBy, v.descending);
    store.page = v.page;
    store.rowsPerPage = v.rowsPerPage;
  },
});
function onPagination(v: { sortBy: string; descending: boolean; page: number; rowsPerPage: number }) {
  pagination.value = v;
}

const selectedProxy = computed({
  get: () => store.selected,
  set: (v: SiteRow[]) => (store.selected = v),
});
function onSelected(v: SiteRow[]) {
  store.selected = v;
}

function onContext(
  scope: "client" | "site",
  row: SiteRow | GroupedClientRow,
  e: MouseEvent,
) {
  emit("row-context", { scope, row, clientX: e.clientX, clientY: e.clientY });
}

function relTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return date.formatDate(d, "YYYY-MM-DD");
}

async function onEditSiteName(row: SiteRow, value: string) {
  const v = value.trim();
  if (!v || v === row.site_name) return;
  try {
    // partial PUT — no need to echo client back; the backend allows it.
    await editSite(row.site_id, { site: { name: v } });
    await store.reloadAfterWrite();
  } catch (e) {
    console.warn("Failed to save site name", e);
  }
}
</script>

<style lang="scss" scoped>
.cstbl {
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

  :deep(.cstbl__table) { background: transparent; }
  :deep(.cstbl__head th) {
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

  &__link {
    color: var(--color-brand-rest, #0078d4);
    text-decoration: none;
    font-weight: var(--intune-font-weight-medium);
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }
  &__num { font-variant-numeric: tabular-nums; }
  &__fail {
    color: var(--color-status-negative-fg, #c50f1f);
    font-weight: var(--intune-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }
  &__warn {
    color: var(--color-status-warning-fg, #b88217);
    font-weight: var(--intune-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }
  &__zero {
    color: var(--color-fg-tertiary);
    font-variant-numeric: tabular-nums;
  }
  &__row { cursor: default; }
}
</style>
