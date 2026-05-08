<!--
  ScriptPickerModal — the shared picker used by:
    1. Phase J Agent Detail Scripts tab → "Run script" button
    2. Phase K BulkActionBar             → bulk run-script entry

  Single-select scripts table (compact mode of the Library), then a small
  form to override args / env / timeout / run-as-user. Confirm dispatches.

  The modal does NOT do the dispatching — it emits the chosen payload and
  lets the caller hit either /agents/<id>/runscript/ or /agents/actions/bulk/.
  Centralising the dispatch in the caller keeps the per-agent / bulk
  branching out of the picker.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
  >
    <q-card class="spm">
      <q-card-section class="spm__head">
        <div>
          <div class="text-h6">{{ headerTitle }}</div>
          <div class="text-caption">{{ headerSubtitle }}</div>
        </div>
        <q-space />
        <q-btn flat dense round icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="spm__top">
        <q-input v-model="search" dense outlined clearable placeholder="Search scripts…" class="spm__search">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <q-btn-toggle
          v-model="typeFilter"
          flat dense no-caps
          :options="[
            { value: 'all',         label: 'All' },
            { value: 'userdefined', label: 'User' },
            { value: 'builtin',     label: 'Built-in' },
          ]"
          toggle-color="primary"
        />
      </q-card-section>

      <div v-if="loading && rows.length === 0" class="spm__state">Loading scripts…</div>
      <div v-else-if="errorMsg && rows.length === 0" class="spm__state spm__state--error">
        Couldn't load scripts: {{ errorMsg }}
      </div>
      <div v-else-if="filteredRows.length === 0" class="spm__state">No matches.</div>
      <div v-else class="spm__list">
        <div
          v-for="row in filteredRows"
          :key="row.id"
          class="spm__row"
          :class="{ 'spm__row--active': selected?.id === row.id }"
          @click="selected = row"
        >
          <q-icon
            :name="row.script_type === 'builtin' ? 'auto_awesome' : 'code'"
            size="18px"
            class="spm__row-icon"
          />
          <div class="spm__row-main">
            <div class="spm__row-name">{{ row.name }}</div>
            <div v-if="row.description" class="spm__row-desc">{{ row.description }}</div>
          </div>
          <span class="spm__row-meta">{{ shellLabel(row.shell) }}</span>
          <q-icon v-if="selected?.id === row.id" name="check" color="primary" />
        </div>
      </div>

      <q-separator v-if="selected" />

      <q-card-section v-if="selected" class="spm__form">
        <div class="spm__form-row">
          <q-input v-model="argsRaw" dense outlined autogrow
                   :rows="2"
                   label="Arguments (one per line)" class="spm__form-grow" />
        </div>
        <div class="spm__form-row">
          <q-input v-model="envRaw" dense outlined autogrow
                   :rows="2"
                   label="Env vars (KEY=value, one per line)" class="spm__form-grow" />
        </div>
        <div class="spm__form-row">
          <q-input v-model.number="timeout" type="number" dense outlined
                   label="Timeout (s)" class="spm__form-grow" />
          <q-toggle v-model="runAsUser" left-label label="Run as logged-in user" />
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="spm__actions">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn unelevated color="primary" :label="confirmLabel"
               :disable="!selected || dispatching" :loading="dispatching"
               @click="onConfirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { fetchScripts } from "@/api/scripts";
import { SHELL_LABELS } from "./columns";

interface ScriptRow {
  id: number;
  name: string;
  description?: string;
  shell: string;
  script_type: "userdefined" | "builtin";
  default_timeout?: number;
  args?: string[];
  env_vars?: string[];
  run_as_user?: boolean;
}

export interface PickerSelection {
  script: ScriptRow;
  args: string[];
  env_vars: string[];
  timeout: number;
  run_as_user: boolean;
}

const props = withDefaults(defineProps<{
  modelValue: boolean;
  /** Caller decides which dispatch branch the user is in; this just affects copy. */
  context?: "agent" | "bulk";
  agentLabel?: string;
  bulkCount?: number;
  /** Optional preselect (e.g. re-run from history) */
  initialScriptId?: number | null;
  /** Set by the caller to indicate dispatch is in flight. */
  dispatching?: boolean;
}>(), {
  context: "agent",
  agentLabel: "",
  bulkCount: 0,
  initialScriptId: null,
  dispatching: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm", payload: PickerSelection): void;
}>();

const rows      = ref<ScriptRow[]>([]);
const loading   = ref(false);
const errorMsg  = ref("");
const search    = ref("");
const typeFilter = ref<"all" | "userdefined" | "builtin">("all");

const selected  = ref<ScriptRow | null>(null);
const argsRaw   = ref("");
const envRaw    = ref("");
const timeout   = ref(90);
const runAsUser = ref(false);

const headerTitle = computed(() =>
  props.context === "bulk"
    ? `Run script on ${props.bulkCount || 0} agent${props.bulkCount === 1 ? "" : "s"}`
    : `Run script on ${props.agentLabel || "agent"}`,
);
const headerSubtitle = computed(() =>
  props.context === "bulk"
    ? "Pick a script. The selected agents will queue this run."
    : "Pick a script. The agent will run it once and capture output.",
);
const confirmLabel = computed(() =>
  props.context === "bulk" ? "Dispatch run" : "Run script",
);

const filteredRows = computed<ScriptRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (typeFilter.value !== "all" && r.script_type !== typeFilter.value) return false;
    if (q) {
      const hay = `${r.name} ${r.description || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

function shellLabel(s: string) { return SHELL_LABELS[s] || s; }

watch(selected, (s) => {
  if (!s) return;
  argsRaw.value   = (s.args || []).join("\n");
  envRaw.value    = (s.env_vars || []).join("\n");
  timeout.value   = s.default_timeout ?? 90;
  runAsUser.value = !!s.run_as_user;
});

watch(() => props.modelValue, async (v) => {
  if (!v) return;
  if (rows.value.length === 0) await load();
  if (props.initialScriptId) {
    selected.value = rows.value.find((r) => r.id === props.initialScriptId) || null;
  }
});

async function load() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchScripts({ showCommunityScripts: true, showHiddenScripts: false });
    rows.value = Array.isArray(data) ? data as ScriptRow[] : [];
  } catch (err) {
    errorMsg.value = extract(err);
  } finally {
    loading.value = false;
  }
}

function extract(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  return d || e?.message || "request failed";
}

function onConfirm() {
  if (!selected.value) return;
  const payload: PickerSelection = {
    script: selected.value,
    args: argsRaw.value.split("\n").map((s) => s.trim()).filter(Boolean),
    env_vars: envRaw.value.split("\n").map((s) => s.trim()).filter(Boolean),
    timeout: Number(timeout.value) || 90,
    run_as_user: runAsUser.value,
  };
  emit("confirm", payload);
}

onMounted(() => {
  if (props.modelValue) void load();
});
</script>

<style lang="scss" scoped>
.spm {
  width: min(720px, 96vw);
  max-height: 86vh;
  display: flex; flex-direction: column;

  &__head {
    display: flex; align-items: center; gap: 8px;
  }
  &__top {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  }
  &__search { min-width: 260px; flex: 1 1 260px; max-width: 420px; }

  &__state {
    color: var(--color-fg-secondary); padding: 28px; text-align: center;
    &--error { color: var(--color-state-negative-fg, #a40e26); }
  }

  &__list {
    overflow: auto;
    max-height: 340px;
    border-top: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
  }
  &__row {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) 110px 18px;
    gap: 10px; align-items: center;
    padding: 8px 16px; cursor: pointer; font-size: 13px;
    border-bottom: 1px solid var(--color-border-subtle);
    &:last-child { border-bottom: none; }
    &:hover  { background: var(--color-bg-page); }
    &--active { background: var(--color-bg-subtle); }
  }
  &__row-icon { color: var(--color-fg-tertiary); }
  &__row-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__row-desc { color: var(--color-fg-secondary); font-size: 11.5px; line-height: 1.3;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__row-meta { color: var(--color-fg-secondary); font-size: 11.5px; }

  &__form {
    display: flex; flex-direction: column; gap: 8px;
    background: var(--color-bg-page);
  }
  &__form-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  &__form-grow { flex: 1 1 0; min-width: 200px; }

  &__actions { padding: 10px 16px; }
}
</style>
