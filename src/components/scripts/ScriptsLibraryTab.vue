<!--
  ScriptsLibraryTab — main scripts library table.

  Backend: GET /scripts/?showCommunityScripts=true&showHiddenScripts=true
  Each row carries a script_type (userdefined | builtin), shell, syntax,
  category, and a favorite flag. Last-run / run-count / last-result are
  derived client-side from the run-history endpoint when needed (lazy:
  only when "Recently run" view or sort by last_run is active).

  Reuses Phase C/I patterns — search box, filter chips, density toggle,
  column picker, saved views (localStorage). Bulk actions at top when
  rows are selected: delete, mark hidden, export JSON.
-->
<template>
  <div class="lib">
    <header class="lib__bar">
      <q-input
        v-model="search"
        dense
        outlined
        clearable
        placeholder="Search scripts…"
        class="lib__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="lib__filter">
        <q-list dense style="min-width: 260px;">
          <q-item-label header>Type</q-item-label>
          <q-item v-for="opt in typeOptions" :key="opt.value" clickable @click="setType(opt.value)" :active="filter.type === opt.value">
            <q-item-section>{{ opt.label }}</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === opt.value" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item-label header>Shell</q-item-label>
          <q-item clickable @click="setShell(null)" :active="!filter.shell">
            <q-item-section>All shells</q-item-section>
            <q-item-section side><q-icon v-if="!filter.shell" name="check" /></q-item-section>
          </q-item>
          <q-item v-for="opt in shellOptions" :key="opt.value" clickable @click="setShell(opt.value)" :active="filter.shell === opt.value">
            <q-item-section>{{ opt.label }}</q-item-section>
            <q-item-section side><q-icon v-if="filter.shell === opt.value" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item-label header>Other</q-item-label>
          <q-item clickable @click="filter.favoritesOnly = !filter.favoritesOnly">
            <q-item-section>Favorites only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.favoritesOnly" dense /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.includeHidden = !filter.includeHidden">
            <q-item-section>Show hidden</q-item-section>
            <q-item-section side><q-toggle v-model="filter.includeHidden" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown flat no-caps icon="bookmark" :label="activeView?.name || 'Saved views'">
        <q-list dense style="min-width: 240px;">
          <q-item-label header>Built-in</q-item-label>
          <q-item v-for="v in BUILTIN_VIEWS" :key="v.id" clickable @click="applyView(v)" :active="activeView?.id === v.id">
            <q-item-section avatar><q-icon name="auto_awesome" size="18px" /></q-item-section>
            <q-item-section>{{ v.name }}</q-item-section>
          </q-item>
          <q-separator spaced v-if="userViews.length" />
          <q-item-label header v-if="userViews.length">Your views</q-item-label>
          <q-item v-for="v in userViews" :key="v.id" clickable @click="applyView(v)" :active="activeView?.id === v.id">
            <q-item-section avatar><q-icon name="bookmark" size="18px" /></q-item-section>
            <q-item-section>{{ v.name }}</q-item-section>
            <q-item-section side><q-btn flat dense round icon="delete" size="sm" @click.stop="deleteView(v)" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item>
            <q-item-section>
              <q-input v-model="newViewName" dense outlined placeholder="Save current as…" @keyup.enter="saveCurrentView" />
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense icon="save" :disable="!newViewName.trim()" @click="saveCurrentView" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />

      <q-btn-toggle
        v-model="density"
        toggle-color="primary"
        flat
        :options="[
          { value: 'compact', icon: 'density_small', label: '' },
          { value: 'comfortable', icon: 'density_medium', label: '' },
        ]"
        dense
        no-caps
      />
      <q-btn-dropdown flat dense icon="view_column" no-caps>
        <q-list dense style="min-width: 220px;">
          <q-item-label header>Visible columns</q-item-label>
          <q-item v-for="c in columnList" :key="c.name" tag="label">
            <q-item-section avatar><q-checkbox v-model="visibleCols" :val="c.name" :disable="c.required" dense /></q-item-section>
            <q-item-section>{{ c.label || c.name }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </header>

    <div v-if="selected.length > 0" class="lib__bulkbar">
      <span class="lib__bulkbar-count">
        <q-icon name="check_circle" size="18px" />
        <b>{{ selected.length }}</b> selected
      </span>
      <q-space />
      <q-btn flat dense no-caps icon="visibility_off" label="Mark hidden" @click="bulkMarkHidden(true)" />
      <q-btn flat dense no-caps icon="visibility"     label="Unhide"      @click="bulkMarkHidden(false)" />
      <q-btn flat dense no-caps icon="download"       label="Export JSON" @click="bulkExport" />
      <q-separator vertical />
      <q-btn flat dense no-caps icon="delete" color="negative" label="Delete" @click="bulkDelete" />
      <q-btn flat dense round icon="close" @click="selected = []" />
    </div>

    <q-table
      v-model:selected="selected"
      :rows="filteredRows"
      :columns="qColumns"
      :visible-columns="visibleCols"
      row-key="id"
      :pagination="pagination"
      :loading="loading"
      :class="`lib__tbl lib__tbl--${density}`"
      flat
      dense
      selection="multiple"
      binary-state-sort
      :rows-per-page-options="[25, 50, 100, 200, 500]"
      @row-click="(_e, row) => onRowClick(row)"
      @row-dblclick="(_e, row) => onRowDblClick(row)"
    >
      <template #body-cell-favorite="p">
        <q-td :props="p" auto-width>
          <q-btn
            flat
            dense
            round
            :icon="p.row.favorite ? 'star' : 'star_outline'"
            :color="p.row.favorite ? 'amber' : 'grey'"
            size="sm"
            @click.stop="toggleFavorite(p.row)"
          />
        </q-td>
      </template>
      <template #body-cell-name="p">
        <q-td :props="p">
          <div class="lib__name">{{ p.row.name }}</div>
          <div v-if="p.row.description" class="lib__desc">{{ p.row.description }}</div>
        </q-td>
      </template>
      <template #body-cell-shell="p">
        <q-td :props="p">{{ SHELL_LABELS[p.row.shell] || p.row.shell }}</q-td>
      </template>
      <template #body-cell-syntax="p">
        <q-td :props="p">
          <q-chip
            dense
            square
            :color="p.row.script_type === 'builtin' ? 'blue-grey-2' : 'green-2'"
            :text-color="p.row.script_type === 'builtin' ? 'blue-grey-9' : 'green-9'"
            class="lib__chip"
          >
            {{ SCRIPT_TYPE_LABELS[p.row.script_type] || p.row.script_type }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-last_run="p">
        <q-td :props="p">{{ formatRelative(runStats.get(p.row.id)?.last_run) }}</q-td>
      </template>
      <template #body-cell-last_result="p">
        <q-td :props="p">
          <span :class="resultClass(runStats.get(p.row.id)?.last_result)">
            {{ runStats.get(p.row.id)?.last_result ?? "—" }}
          </span>
        </q-td>
      </template>
      <template #body-cell-run_count="p">
        <q-td :props="p" class="lib__num">{{ runStats.get(p.row.id)?.run_count ?? 0 }}</q-td>
      </template>
      <template #body-cell-hidden="p">
        <q-td :props="p" auto-width>
          <q-icon v-if="p.row.hidden" name="visibility_off" color="grey" />
        </q-td>
      </template>
      <template #body-cell-supported="p">
        <q-td :props="p">{{ (p.row.supported_platforms || []).join(", ") || "all" }}</q-td>
      </template>

      <template #no-data>
        <div class="lib__empty">
          <q-icon name="code_off" size="40px" />
          <div>No scripts match your filters.</div>
        </div>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import {
  fetchScripts,
  editScript,
  removeScript,
  fetchScriptRunHistory,
} from "@/api/scripts";
import {
  QTABLE_SCRIPT_COLUMNS,
  SCRIPT_COLUMNS,
  SHELL_LABELS,
  SHELL_OPTIONS,
  SCRIPT_TYPE_LABELS,
} from "./columns";

interface ScriptRow {
  id: number;
  name: string;
  description?: string;
  shell: string;
  category: string;
  script_type: "userdefined" | "builtin";
  favorite: boolean;
  hidden: boolean;
  supported_platforms?: string[];
  default_timeout?: number;
}

interface RunStat {
  last_run: string | null;
  last_result: number | string | null;
  run_count: number;
}

interface SavedView {
  id: string;
  name: string;
  filter: typeof DEFAULT_FILTER;
  search: string;
  visibleCols?: string[];
  density?: "compact" | "comfortable";
  builtin?: boolean;
}

const $q = useQuasar();

const DEFAULT_FILTER = {
  type: "all" as "all" | "user" | "builtin",
  shell: null as string | null,
  favoritesOnly: false,
  includeHidden: false,
  recentlyRunDays: 0, // 0 disables; > 0 keeps only scripts run in last N days
  failedLast7: false,
};

const BUILTIN_VIEWS: SavedView[] = [
  {
    id: "builtin:all",
    name: "All scripts",
    filter: { ...DEFAULT_FILTER, includeHidden: true },
    search: "",
    builtin: true,
  },
  {
    id: "builtin:my",
    name: "My scripts",
    filter: { ...DEFAULT_FILTER, type: "user" },
    search: "",
    builtin: true,
  },
  {
    id: "builtin:recent",
    name: "Recently run",
    filter: { ...DEFAULT_FILTER, recentlyRunDays: 7 },
    search: "",
    builtin: true,
  },
  {
    id: "builtin:failed7",
    name: "Failed last 7 days",
    filter: { ...DEFAULT_FILTER, failedLast7: true },
    search: "",
    builtin: true,
  },
];

const VIEW_STORE_KEY = "trmm:scripts:user-views";
const SETTINGS_STORE_KEY = "trmm:scripts:settings";

const search   = ref("");
const filter   = ref({ ...DEFAULT_FILTER });
const density  = ref<"compact" | "comfortable">("comfortable");
const visibleCols = ref<string[]>(SCRIPT_COLUMNS.map((c) => c.name));
const selected = ref<ScriptRow[]>([]);
const rows     = ref<ScriptRow[]>([]);
const loading  = ref(true);
const runStats = ref<Map<number, RunStat>>(new Map());

const userViews  = ref<SavedView[]>(loadUserViews());
const activeView = ref<SavedView | null>(null);
const newViewName = ref("");

const columnList = SCRIPT_COLUMNS;
const qColumns = QTABLE_SCRIPT_COLUMNS;
const pagination = ref({ rowsPerPage: 50, sortBy: "name", descending: false });

const typeOptions = [
  { value: "all",     label: "All" },
  { value: "user",    label: "User-created" },
  { value: "builtin", label: "Built-in / Community" },
];
const shellOptions = SHELL_OPTIONS;

const filterLabel = computed(() => {
  const parts: string[] = [];
  if (filter.value.type !== "all") parts.push(filter.value.type === "user" ? "User" : "Built-in");
  if (filter.value.shell)          parts.push(SHELL_LABELS[filter.value.shell] || filter.value.shell);
  if (filter.value.favoritesOnly)  parts.push("⭐");
  if (filter.value.recentlyRunDays > 0) parts.push(`Last ${filter.value.recentlyRunDays}d`);
  if (filter.value.failedLast7)    parts.push("Failed 7d");
  if (parts.length === 0) return "Filter";
  return parts.join(" · ");
});

function setType(v: typeof DEFAULT_FILTER.type) { filter.value.type = v; }
function setShell(v: string | null) { filter.value.shell = v; }

const filteredRows = computed<ScriptRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  const days = filter.value.recentlyRunDays;
  const cutoff = days > 0 ? Date.now() - days * 86400_000 : 0;

  return rows.value.filter((r) => {
    if (!filter.value.includeHidden && r.hidden) return false;
    if (filter.value.type === "user"    && r.script_type !== "userdefined") return false;
    if (filter.value.type === "builtin" && r.script_type !== "builtin")     return false;
    if (filter.value.shell && r.shell !== filter.value.shell) return false;
    if (filter.value.favoritesOnly && !r.favorite) return false;

    if (q) {
      const hay = `${r.name} ${r.description || ""} ${r.category || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (days > 0) {
      const lr = runStats.value.get(r.id)?.last_run;
      if (!lr) return false;
      if (Date.parse(lr) < cutoff) return false;
    }

    if (filter.value.failedLast7) {
      const stat = runStats.value.get(r.id);
      if (!stat) return false;
      const lr = stat.last_run; const code = stat.last_result;
      if (!lr || Date.parse(lr) < Date.now() - 7 * 86400_000) return false;
      if (code === 0 || code === "0") return false;
    }
    return true;
  });
});

async function reload() {
  loading.value = true;
  try {
    const data = await fetchScripts({
      showCommunityScripts: true,
      showHiddenScripts: true,
    });
    rows.value = Array.isArray(data) ? data as ScriptRow[] : [];
    void loadRunStats();
  } catch (err) {
    rows.value = [];
    notifyError(err, "Couldn't load scripts");
  } finally {
    loading.value = false;
  }
}

// Best-effort run stats — if the endpoint is slow on large fleets we just
// skip and the column shows "—" / 0 (Karpathy: don't pretend we have data).
async function loadRunStats() {
  try {
    const data = await fetchScriptRunHistory({ limit: 1000 });
    const list = Array.isArray(data) ? data : [];
    const map = new Map<number, RunStat>();
    for (const r of list) {
      const id = r.script;
      if (!id) continue;
      const stat = map.get(id) || { last_run: null, last_result: null, run_count: 0 };
      stat.run_count += 1;
      if (!stat.last_run || (r.time && r.time > stat.last_run)) {
        stat.last_run = r.time;
        const code = r.script_results?.retcode;
        stat.last_result = code === undefined || code === null ? "—" : code;
      }
      map.set(id, stat);
    }
    runStats.value = map;
  } catch (_err) {
    // Silent — table still functions without run stats.
  }
}

function notifyError(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const detail = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  $q.notify({ type: "negative", message: detail || e?.message || fallback, position: "top" });
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso); if (Number.isNaN(t)) return iso;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60)    return "just now";
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

function resultClass(code: number | string | null | undefined): string {
  if (code === 0 || code === "0") return "lib__result lib__result--ok";
  if (code === undefined || code === null || code === "—") return "";
  return "lib__result lib__result--bad";
}

const emit = defineEmits<{
  (e: "open-script", id: number): void;
  (e: "new-script"): void;
}>();

function onRowClick(row: ScriptRow) {
  emit("open-script", row.id);
}
function onRowDblClick(row: ScriptRow) {
  // Use the same drawer; double-click → full page would be a router push,
  // but for now the drawer is the primary surface and dbl-click matches
  // the row-click affordance. Page route still works via direct URL.
  emit("open-script", row.id);
}

async function toggleFavorite(row: ScriptRow) {
  try {
    await editScript({ id: row.id, favorite: !row.favorite });
    row.favorite = !row.favorite;
  } catch (err) {
    notifyError(err, "Couldn't toggle favorite");
  }
}

async function bulkMarkHidden(hidden: boolean) {
  try {
    await Promise.all(selected.value.map((r) => editScript({ id: r.id, hidden })));
    for (const r of selected.value) r.hidden = hidden;
    $q.notify({ type: "positive", message: `Marked ${selected.value.length} script(s) ${hidden ? "hidden" : "visible"}`, position: "top" });
    selected.value = [];
  } catch (err) {
    notifyError(err, "Couldn't update scripts");
  }
}

async function bulkDelete() {
  // built-ins can't be deleted server-side; warn and skip them
  const deletable = selected.value.filter((r) => r.script_type !== "builtin");
  const skipped = selected.value.length - deletable.length;
  if (deletable.length === 0) {
    $q.notify({ type: "warning", message: "Built-in scripts can't be deleted.", position: "top" });
    return;
  }
  $q.dialog({
    title: "Delete scripts?",
    message: `Permanently delete ${deletable.length} script(s)?${skipped ? ` ${skipped} built-in(s) will be skipped.` : ""}`,
    cancel: true,
    persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await Promise.all(deletable.map((r) => removeScript(r.id)));
      rows.value = rows.value.filter((r) => !deletable.find((d) => d.id === r.id));
      selected.value = [];
      $q.notify({ type: "positive", message: `Deleted ${deletable.length} script(s)`, position: "top" });
    } catch (err) {
      notifyError(err, "Couldn't delete some scripts");
    }
  });
}

function bulkExport() {
  const out = selected.value.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    shell: r.shell,
    category: r.category,
    script_type: r.script_type,
    favorite: r.favorite,
    hidden: r.hidden,
    supported_platforms: r.supported_platforms,
    default_timeout: r.default_timeout,
  }));
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `scripts-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  $q.notify({ type: "positive", message: `Exported ${out.length} script(s)`, position: "top" });
}

// saved views
function loadUserViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEW_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function persistUserViews() {
  try { localStorage.setItem(VIEW_STORE_KEY, JSON.stringify(userViews.value)); } catch { /* ignore */ }
}

function applyView(v: SavedView) {
  filter.value = { ...DEFAULT_FILTER, ...v.filter };
  search.value = v.search || "";
  if (v.visibleCols) visibleCols.value = [...v.visibleCols];
  if (v.density)     density.value     = v.density;
  activeView.value = v;
}

function saveCurrentView() {
  const name = newViewName.value.trim();
  if (!name) return;
  const v: SavedView = {
    id: `user:${Date.now()}`,
    name,
    filter: { ...filter.value },
    search: search.value,
    visibleCols: [...visibleCols.value],
    density: density.value,
  };
  userViews.value = [...userViews.value, v];
  persistUserViews();
  activeView.value = v;
  newViewName.value = "";
  $q.notify({ type: "positive", message: `Saved view "${name}"`, position: "top" });
}

function deleteView(v: SavedView) {
  userViews.value = userViews.value.filter((x) => x.id !== v.id);
  if (activeView.value?.id === v.id) activeView.value = null;
  persistUserViews();
}

// persist density + visible cols (small UX nicety)
watch([density, visibleCols], () => {
  try {
    localStorage.setItem(SETTINGS_STORE_KEY, JSON.stringify({
      density: density.value,
      visibleCols: visibleCols.value,
    }));
  } catch { /* ignore */ }
}, { deep: true });

function restoreSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.density === "compact" || parsed.density === "comfortable") density.value = parsed.density;
    if (Array.isArray(parsed.visibleCols)) visibleCols.value = parsed.visibleCols;
  } catch { /* ignore */ }
}

onMounted(() => {
  restoreSettings();
  void reload();
});

defineExpose({ reload });
</script>

<style lang="scss" scoped>
.lib {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  &__search {
    min-width: 320px;
    flex: 1 0 320px;
    max-width: 480px;
  }
  &__filter,
  :deep(.q-btn-dropdown__arrow) { color: var(--color-fg-secondary); }

  &__bulkbar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-brand-rest, #0078d4);
    color: white;
    padding: 6px 10px;
    border-radius: var(--intune-radius-medium);
    :deep(.q-btn) { color: white; }
    :deep(.q-separator) { background: rgba(255,255,255,0.3); height: 18px; margin: 0 2px; }
  }
  &__bulkbar-count { display: inline-flex; align-items: center; gap: 6px; }

  &__tbl {
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    background: var(--color-bg-surface);

    :deep(thead tr th) {
      background: var(--color-bg-page);
      color: var(--color-fg-secondary);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    :deep(tbody tr) { cursor: pointer; }
    :deep(tbody tr:hover td) { background: var(--color-bg-page); }
    :deep(tbody tr.selected td) { background: var(--color-bg-subtle); }
  }
  &__tbl--compact :deep(tbody td) { padding: 4px 10px; }
  &__tbl--comfortable :deep(tbody td) { padding: 8px 12px; }

  &__name { font-weight: var(--intune-font-weight-medium); }
  &__desc { color: var(--color-fg-secondary); font-size: 12px; line-height: 1.3;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 480px; }
  &__chip { font-size: 10px; }
  &__num  { font-variant-numeric: tabular-nums; }

  &__result--ok  { color: #107c10; font-weight: 600; }
  &__result--bad { color: #b32128; font-weight: 600; }

  &__empty {
    display: flex; flex-direction: column; align-items: center;
    color: var(--color-fg-secondary); padding: 32px; gap: 8px;
  }
}
</style>
