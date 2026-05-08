<!--
  AutomationTab — Agent Detail Automation tab (Phase N writable rebuild).

  Two sub-sections:
    1. Inherited from policies — the Phase J read-only summary (kept).
       Phase O builds the full policy editor; this section just shows what
       policies are effective on this agent and rough counts.
    2. Agent-specific tasks — the Phase N write surface. Lists the agent's
       direct (non-policy) AutomatedTasks. Add / Edit / Delete / Run-now
       via the new TaskEditor drawer.

  Backends:
    - GET /agents/<id>/  — applied_policies map (Phase J path).
    - GET /agents/<id>/tasks/  — agent-resolved task list (includes
      inherited policy tasks; we client-filter to "policy is null" for the
      agent-specific section).
    - POST /tasks/, PUT /tasks/<id>/, DELETE /tasks/<id>/, POST /tasks/<id>/run/
-->
<template>
  <div class="ad-tab">

    <!-- ============== Inherited from policies =============== -->
    <section class="ad-tab__section">
      <header class="ad-tab__section-head">
        <h3 class="ad-tab__section-title">Inherited from policies</h3>
        <q-space />
        <q-btn
          flat dense no-caps icon="refresh"
          :loading="loadingPolicies"
          @click="loadPolicies"
        />
      </header>

      <div v-if="loadingPolicies && !appliedPolicies" class="state">Loading policies…</div>
      <div v-else-if="policiesError" class="state state--error">
        Couldn't load policies: {{ policiesError }}
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
              <router-link
                v-if="src.policy && (src.policy.id ?? src.policy.pk)"
                :to="{ name: 'PolicyDetail', params: { id: src.policy.id ?? src.policy.pk } }"
                class="card__name card__name--link"
              >
                {{ src.policy.name || "—" }}
                <q-icon name="open_in_new" size="12px" class="card__name-ic" />
              </router-link>
              <h4 v-else class="card__name">{{ src.policy?.name || "—" }}</h4>
            </div>
            <span class="badge" :class="src.policy?.active ? 'badge--ok' : 'badge--neutral'">
              {{ src.policy?.active ? "active" : "inactive" }}
            </span>
          </header>

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
      <div class="ad-tab__hint">
        Click a policy name to open it in the policy editor.
      </div>
    </section>

    <q-separator class="ad-tab__sep" />

    <!-- ============== Agent-specific tasks =============== -->
    <section class="ad-tab__section">
      <header class="ad-tab__section-head ad-tab__section-head--actions">
        <h3 class="ad-tab__section-title">Agent-specific tasks</h3>
        <q-btn
          unelevated color="primary"
          icon="add" label="Add task" no-caps size="sm"
          @click="onAdd"
        />
        <q-space />
        <q-btn flat dense icon="refresh" :loading="loadingTasks" @click="loadTasks">
          <q-tooltip>Refresh</q-tooltip>
        </q-btn>
      </header>

      <div v-if="loadingTasks && agentTasks.length === 0" class="state">Loading tasks…</div>
      <div v-else-if="tasksError" class="state state--error">
        <q-icon name="error_outline" /> {{ tasksError }}
      </div>
      <div v-else-if="agentTasks.length === 0" class="state state--empty">
        <q-icon name="schedule" size="32px" />
        <p>No agent-specific tasks defined.</p>
        <q-btn unelevated color="primary" icon="add" label="Add task" no-caps @click="onAdd" />
      </div>
      <q-table
        v-else
        :rows="agentTasks"
        :columns="columns"
        row-key="id"
        :pagination="pagination"
        flat dense
        class="ad-tab__tbl"
        hide-bottom
        :rows-per-page-options="[0]"
      >
        <template #body-cell-status="p">
          <q-td :props="p" auto-width>
            <span class="chip" :class="`chip--${statusTone(p.row)}`">
              {{ statusLabel(p.row) }}
            </span>
          </q-td>
        </template>
        <template #body-cell-name="p">
          <q-td :props="p">
            <div class="ad-tab__name">{{ p.row.name || "(unnamed)" }}</div>
            <div class="ad-tab__sub">{{ actionsSummary(p.row) }}</div>
          </q-td>
        </template>
        <template #body-cell-schedule="p">
          <q-td :props="p">{{ p.row.schedule || formatSchedule(p.row) }}</q-td>
        </template>
        <template #body-cell-last_run="p">
          <q-td :props="p">{{ formatRelative(p.row.task_result?.last_run) }}</q-td>
        </template>
        <template #body-cell-enabled="p">
          <q-td :props="p" auto-width>
            <q-toggle
              :model-value="!!p.row.enabled"
              dense
              @update:model-value="(v) => toggleEnabled(p.row, v)"
              @click.stop
            />
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" auto-width>
            <q-btn flat dense round icon="edit" size="sm" @click.stop="onEdit(p.row)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="play_arrow" size="sm" @click.stop="runOne(p.row)">
              <q-tooltip>Run now</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="delete" color="negative" size="sm" @click.stop="onDelete(p.row)">
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </section>

    <TaskEditor
      v-model="editorOpen"
      :task-id="editingId"
      :agent-id="agentId"
      :agent-label="agentLabel"
      @saved="onSaved"
      @ran="loadTasks"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { fetchAgent, fetchAgentTasks } from "@/api/agents";
import { removeTask, runTask, updateTask } from "@/api/tasks";
import TaskEditor from "@/components/tasks/TaskEditor.vue";
import { formatSchedule } from "@/components/tasks/scheduleHelpers.js";
import { notifySuccess, notifyError } from "@/utils/notify";

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
interface TaskRow {
  id: number;
  name: string;
  task_type: string;
  enabled: boolean;
  policy: number | null;
  agent: number | null;
  alert_severity?: string;
  schedule?: string;
  actions?: Array<{ type: string; command?: string; script?: number }>;
  task_result?: { last_run?: string | null; status?: string } | null;
  run_time_date?: string | null;
  daily_interval?: number;
  weekly_interval?: number;
  run_time_bit_weekdays?: number;
  monthly_months_of_year?: number;
  monthly_days_of_month?: number;
  monthly_weeks_of_month?: number;
}

const props = defineProps<{
  agentId: string;
  status: { hostname: string | null } | null;
}>();

const $q = useQuasar();

const agentLabel = computed(() => props.status?.hostname || props.agentId);

// ── inherited policies ────────────────────────────────────────────────
const appliedPolicies = ref<AppliedPolicies | null>(null);
const loadingPolicies = ref(true);
const policiesError = ref("");

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

async function loadPolicies() {
  if (!props.agentId) return;
  loadingPolicies.value = true;
  policiesError.value = "";
  try {
    const data = await fetchAgent(props.agentId) as { applied_policies?: AppliedPolicies };
    appliedPolicies.value = data?.applied_policies ?? null;
  } catch (err) {
    policiesError.value = extractMessage(err);
  } finally {
    loadingPolicies.value = false;
  }
}

// ── agent tasks ───────────────────────────────────────────────────────
const allAgentTasks = ref<TaskRow[]>([]);
const loadingTasks = ref(false);
const tasksError = ref("");

const agentTasks = computed(() =>
  // Drop policy-attached rows — those live under "Inherited" above and
  // can only be edited via the policy editor (Phase O).
  allAgentTasks.value.filter((t) => !t.policy),
);

async function loadTasks() {
  if (!props.agentId) return;
  loadingTasks.value = true;
  tasksError.value = "";
  try {
    const data = await fetchAgentTasks(props.agentId);
    allAgentTasks.value = Array.isArray(data) ? (data as TaskRow[]) : [];
  } catch (e) {
    tasksError.value = extractMessage(e);
  }
  loadingTasks.value = false;
}

// ── editor ────────────────────────────────────────────────────────────
const editorOpen = ref(false);
const editingId = ref<number | null>(null);

function onAdd() {
  editingId.value = null;
  editorOpen.value = true;
}
function onEdit(row: TaskRow) {
  editingId.value = row.id;
  editorOpen.value = true;
}
async function onSaved() {
  await loadTasks();
}

function onDelete(row: TaskRow) {
  $q.dialog({
    title: "Delete task?",
    message: `${row.name} — this can't be undone.`,
    cancel: true,
    persistent: true,
    ok: { color: "negative", label: "Delete", flat: false },
  }).onOk(async () => {
    try {
      await removeTask(row.id);
      notifySuccess("Task deleted");
      await loadTasks();
    } catch (e) {
      notifyError(extractMessage(e));
    }
  });
}

async function runOne(row: TaskRow) {
  try {
    const res = await runTask(row.id);
    notifySuccess(typeof res === "string" ? res : "Run dispatched");
  } catch (e) {
    notifyError(extractMessage(e));
  }
}

async function toggleEnabled(row: TaskRow, v: boolean) {
  try {
    await updateTask(row.id, { enabled: !!v });
    row.enabled = !!v;
    notifySuccess(v ? "Task enabled" : "Task disabled");
  } catch (e) {
    notifyError(extractMessage(e));
  }
}

// ── helpers ───────────────────────────────────────────────────────────
const pagination = { rowsPerPage: 0 };

const columns = [
  { name: "status",   label: "Status",   field: "status",     align: "left" as const },
  { name: "name",     label: "Name",     field: "name",       align: "left" as const },
  { name: "schedule", label: "Schedule", field: "schedule",   align: "left" as const },
  { name: "last_run", label: "Last run", field: (r: TaskRow) => r.task_result?.last_run, align: "left" as const },
  { name: "enabled",  label: "Enabled",  field: "enabled",    align: "left" as const },
  { name: "actions",  label: "",         field: "actions",    align: "right" as const },
];

function actionsSummary(r: TaskRow): string {
  const acts = Array.isArray(r.actions) ? r.actions : [];
  if (acts.length === 0) return "(no actions)";
  if (acts.length === 1) {
    const a = acts[0];
    return a.type === "cmd" ? `cmd: ${(a.command || "").slice(0, 60)}` : "script action";
  }
  return `${acts.length} actions`;
}

function statusLabel(r: TaskRow) {
  const s = r.task_result?.status;
  if (!s) return r.enabled ? "pending" : "disabled";
  return s;
}
function statusTone(r: TaskRow) {
  if (!r.enabled) return "neutral";
  const s = r.task_result?.status;
  if (s === "passing") return "positive";
  if (s === "failing") return r.alert_severity === "error" ? "negative" : "warning";
  return "neutral";
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return d.toLocaleString();
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  return d || e?.message || "request failed";
}

watch(() => props.agentId, () => { void loadPolicies(); void loadTasks(); });
onMounted(() => { void loadPolicies(); void loadTasks(); });
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 12px 4px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  &__section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    &--actions { gap: 12px; }
  }
  &__section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-fg-primary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  &__hint {
    font-size: 12px;
    color: var(--color-fg-tertiary, var(--color-fg-secondary));
    padding-left: 4px;
  }
  &__sep {
    margin: 0;
  }
  &__tbl {
    background: var(--color-bg-surface);
  }
  &__name { font-weight: 500; }
  &__sub  { font-size: 12px; color: var(--color-fg-secondary); }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-surface);
  border: 1px dashed var(--color-border-subtle);
  border-radius: 8px;

  p { margin: 0; }
  &--error { color: var(--color-state-negative-fg, #a40e26); }
  &--empty { padding: 40px 16px; }
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

  &--inactive { opacity: 0.55; }

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

.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--color-bg-page);
  color: var(--color-fg-secondary);
  border: 1px solid var(--color-border-subtle);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--warning {
    background: var(--color-state-warning-bg, #fff5e0);
    color: var(--color-state-warning-fg, #8a5a00);
    border-color: transparent;
  }
  &--negative {
    background: var(--color-state-negative-bg, #fde7e9);
    color: var(--color-state-negative-fg, #a40e26);
    border-color: transparent;
  }
}
</style>
