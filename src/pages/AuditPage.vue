<!--
  AuditPage — Phase R /audit route under AppShell.

  Read-only history of every admin action recorded by AuditLog. Reuses the
  Phase C/M/I table chrome (filter band + density + dense table + saved
  views menu) and the Phase G server-side SavedView model. CSV export
  mirrors Phase G/L pattern.

  Route: /audit?... (saved-view query keys mirror filter shape).
-->
<template>
  <q-page class="aud">
    <header class="aud__hero">
      <div>
        <h1 class="aud__title">Audit log</h1>
        <p class="aud__lede">
          Who did what, when, and against which target. Filter to investigate
          a specific user or window, save a view for repeat checks, and export
          CSV for compliance evidence.
        </p>
      </div>
      <div class="aud__hero-meta">
        <span class="aud__count">
          <strong>{{ total }}</strong> {{ total === 1 ? "entry" : "entries" }}
        </span>
        <q-btn
          flat dense icon="download" color="primary" label="Export CSV"
          :disable="loading || total === 0"
          @click="onExportCsv"
        />
        <q-btn
          flat dense icon="refresh" color="primary" aria-label="Refresh"
          @click="reload"
        />
      </div>
    </header>

    <AuditFilterBand
      v-model:userFilter="filters.userFilter"
      v-model:actionFilter="filters.actionFilter"
      v-model:objectFilter="filters.objectFilter"
      v-model:timeFilter="filters.timeFilter"
      v-model:agentSearch="filters.agentSearch"
      :saved-views="savedViews"
      :active-view-id="activeViewId"
      @save-view="onSaveView"
      @apply-view="onApplyView"
      @delete-view="onDeleteView"
    />

    <q-table
      class="aud__table"
      :rows="rows"
      :columns="columns"
      row-key="id"
      flat bordered dense
      :loading="loading"
      v-model:pagination="pagination"
      :rows-per-page-options="[25, 50, 100, 200]"
      @request="onRequest"
      @row-click="onRowClick"
      :no-data-label="loading ? 'Loading…' : 'No audit entries match.'"
    >
      <template #body-cell-entry_time="p">
        <q-td :props="p">
          <span :title="absoluteTime(p.value)">{{ relativeTime(p.value) }}</span>
        </q-td>
      </template>
      <template #body-cell-action="p">
        <q-td :props="p">
          <span class="aud__chip" :data-kind="actionTone(p.value)">
            {{ actionLabel(p.value) }}
          </span>
        </q-td>
      </template>
      <template #body-cell-target="p">
        <q-td :props="p">
          <component
            :is="p.row.agent_id ? 'router-link' : 'span'"
            :to="p.row.agent_id ? `/devices/${p.row.agent_id}` : undefined"
            class="aud__link"
            v-if="p.row.agent || p.row.agent_id"
          >
            {{ p.row.agent || p.row.agent_id }}
          </component>
          <span v-else class="aud__muted">—</span>
        </q-td>
      </template>
      <template #body-cell-message="p">
        <q-td :props="p" class="aud__msg">
          {{ p.row.message || "—" }}
        </q-td>
      </template>
    </q-table>

    <AuditDetailDrawer
      v-if="activeRow"
      :row="activeRow"
      @close="activeRow = null"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useQuasar } from "quasar";

import {
  AUDIT_ACTIONS,
  AUDIT_OBJECTS,
  fetchAuditLogs,
  type AuditLogRow,
  type AuditPagination,
} from "@/api/audit";
import {
  createSavedView, deleteSavedView, listSavedViews,
  type SavedView, type SavedViewKind,
} from "@/api/savedViews";

import AuditFilterBand    from "@/components/audit/AuditFilterBand.vue";
import AuditDetailDrawer  from "@/components/audit/AuditDetailDrawer.vue";

const $q = useQuasar();

const filters = reactive({
  userFilter:   [] as string[],
  actionFilter: [] as string[],
  objectFilter: [] as string[],
  timeFilter:   30 as number | null,   // last 30 days by default
  agentSearch:  "",
});

const pagination = ref<AuditPagination & { rowsNumber: number }>({
  sortBy: "entry_time",
  descending: true,
  page: 1,
  rowsPerPage: 50,
  rowsNumber: 0,
});

const rows  = ref<AuditLogRow[]>([]);
const total = ref(0);
const loading = ref(false);

const columns = [
  { name: "entry_time", label: "When",   field: "entry_time", align: "left" as const, sortable: true },
  { name: "username",   label: "User",   field: "username",   align: "left" as const, sortable: true },
  { name: "action",     label: "Action", field: "action",     align: "left" as const, sortable: true },
  { name: "object_type",label: "Object", field: "object_type",align: "left" as const },
  { name: "target",     label: "Target", field: "agent",      align: "left" as const },
  { name: "message",    label: "Detail", field: "message",    align: "left" as const },
];

async function load() {
  loading.value = true;
  try {
    const r = await fetchAuditLogs({
      pagination: {
        sortBy: pagination.value.sortBy,
        descending: pagination.value.descending,
        page: pagination.value.page,
        rowsPerPage: pagination.value.rowsPerPage,
      },
      userFilter:   filters.userFilter,
      actionFilter: filters.actionFilter,
      objectFilter: filters.objectFilter,
      timeFilter:   filters.timeFilter ?? undefined,
    });
    rows.value  = r.audit_logs;
    total.value = r.total;
    pagination.value.rowsNumber = r.total;
  } catch (e) {
    // Polling stops on 4xx via interceptor; show a non-fatal hint.
    // eslint-disable-next-line no-console
    console.error("[audit] load:", e);
    $q.notify({ type: "negative", message: "Could not load audit log." });
  } finally {
    loading.value = false;
  }
}

function reload() { void load(); }

function onRequest(req: { pagination: typeof pagination.value }) {
  pagination.value = { ...pagination.value, ...req.pagination };
  void load();
}

watch(
  () => [filters.userFilter, filters.actionFilter, filters.objectFilter, filters.timeFilter],
  () => { pagination.value.page = 1; void load(); },
  { deep: true },
);

// --- Row drawer ---
const activeRow = ref<AuditLogRow | null>(null);
function onRowClick(_e: Event, row: AuditLogRow) { activeRow.value = row; }

// --- Saved views ---
const savedViews    = ref<SavedView[]>([]);
const activeViewId  = ref<number | null>(null);

const BUILTINS: Array<{ name: string; query: Record<string, unknown> }> = [
  { name: "Last 24 hours", query: { timeFilter: 1 } },
  { name: "Failed logins", query: { actionFilter: ["failed_login"], timeFilter: 7 } },
  { name: "Bulk actions",  query: { actionFilter: ["bulk_action"], timeFilter: 30 } },
];

async function loadSavedViews() {
  try {
    const remote = await listSavedViews("audit" as unknown as SavedViewKind);
    // Surface built-ins first, then user views.
    const builtinViews: SavedView[] = BUILTINS.map((b, i) => ({
      id: -(i + 1),
      kind: "audit",
      name: b.name,
      query: b.query,
      is_shared: true,
      owner_username: "(built-in)",
      is_owner: false,
      created_at: "",
      updated_at: "",
    }));
    savedViews.value = [...builtinViews, ...remote];
  } catch {
    /* best-effort */
  }
}

function onApplyView(v: SavedView) {
  activeViewId.value = v.id;
  filters.userFilter   = (v.query.userFilter   as string[]) ?? [];
  filters.actionFilter = (v.query.actionFilter as string[]) ?? [];
  filters.objectFilter = (v.query.objectFilter as string[]) ?? [];
  filters.timeFilter   = (v.query.timeFilter   as number)   ?? null;
}

async function onSaveView(name: string) {
  try {
    const created = await createSavedView({
      kind: "audit" as unknown as SavedViewKind,
      name,
      query: {
        userFilter:   filters.userFilter,
        actionFilter: filters.actionFilter,
        objectFilter: filters.objectFilter,
        timeFilter:   filters.timeFilter,
      },
    });
    activeViewId.value = created.id;
    await loadSavedViews();
    $q.notify({ type: "positive", message: `Saved view "${name}".` });
  } catch (e) {
    $q.notify({ type: "negative", message: "Could not save view." });
  }
}

async function onDeleteView(id: number) {
  if (id < 0) return; // built-in
  try {
    await deleteSavedView(id);
    if (activeViewId.value === id) activeViewId.value = null;
    await loadSavedViews();
  } catch (e) {
    $q.notify({ type: "negative", message: "Could not delete view." });
  }
}

// --- CSV export ---
async function onExportCsv() {
  try {
    // Fetch in chunks of 500 up to 10k rows for export.
    const chunks: AuditLogRow[] = [];
    let page = 1;
    while (chunks.length < total.value && chunks.length < 10_000) {
      const r = await fetchAuditLogs({
        pagination: {
          sortBy: pagination.value.sortBy,
          descending: pagination.value.descending,
          page,
          rowsPerPage: 500,
        },
        userFilter:   filters.userFilter,
        actionFilter: filters.actionFilter,
        objectFilter: filters.objectFilter,
        timeFilter:   filters.timeFilter ?? undefined,
      });
      chunks.push(...r.audit_logs);
      if (r.audit_logs.length < 500) break;
      page += 1;
    }
    const header = ["entry_time", "username", "action", "object_type", "agent", "agent_id", "ip_address", "message"];
    const lines = [header.join(",")];
    for (const r of chunks) {
      lines.push(header.map(h => csvCell((r as unknown as Record<string, unknown>)[h] ?? "")).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit] csv:", e);
    $q.notify({ type: "negative", message: "Export failed." });
  }
}

function csvCell(v: unknown): string {
  const s = (v == null ? "" : String(v)).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// --- Helpers ---
function actionLabel(a: string): string {
  return AUDIT_ACTIONS.find(x => x.value === a)?.label ?? a;
}
function actionTone(a: string): "warn" | "neg" | "info" | "" {
  if (a === "failed_login")                          return "neg";
  if (a === "delete")                                return "warn";
  if (a === "bulk_action" || a === "remote_session") return "info";
  return "";
}
function relativeTime(t: string): string {
  if (!t) return "—";
  const d = new Date(t);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)         return `${Math.round(diff)}s ago`;
  if (diff < 3600)       return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7)  return `${Math.round(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
function absoluteTime(t: string): string {
  return t ? new Date(t).toLocaleString() : "";
}

// expose enum tables to the filter band
defineExpose({ AUDIT_ACTIONS, AUDIT_OBJECTS });

onMounted(() => {
  void loadSavedViews();
  void load();
});
</script>

<style lang="scss" scoped>
.aud {
  padding: 28px 32px 64px;
  max-width: 1600px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 12px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    max-width: 720px;
    margin: 0;
  }
  &__hero-meta {
    display: flex; align-items: center; gap: 12px;
    color: var(--color-fg-secondary);
    font-size: var(--intune-font-size-200);
  }
  &__count strong {
    color: var(--color-fg-primary);
    font-size: var(--intune-font-size-400);
    margin-right: 4px;
  }
  &__table {
    margin-top: 12px;
    background: var(--color-bg-surface-1);
  }
  &__msg {
    color: var(--color-fg-secondary);
    max-width: 480px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__link {
    color: var(--color-fg-link, #2667c6);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  &__muted { color: var(--color-fg-tertiary); }
  &__chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--intune-radius-circular);
    font-size: var(--intune-font-size-200);
    background: var(--color-bg-surface-2);
    color: var(--color-fg-secondary);
    border: 1px solid var(--color-stroke-divider);
    &[data-kind="warn"] { background: rgba(255, 170, 68, 0.16); color: #b56b00; border-color: rgba(255, 170, 68, 0.4); }
    &[data-kind="neg"]  { background: rgba(232,  68, 86, 0.14); color: #b32d3d; border-color: rgba(232, 68, 86, 0.4); }
    &[data-kind="info"] { background: rgba( 32,128,232, 0.12); color: #1f5fbb; border-color: rgba(32,128,232, 0.4); }
  }
}
</style>
