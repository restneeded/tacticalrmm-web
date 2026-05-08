<!--
  TaskEditor — Phase N central editor for AutomatedTasks.

  Mounted as a side drawer from:
    1. Agent Detail Automation tab → "Add task" / row → Edit
    2. /tasks Library tab "Add task" / row → Edit
    3. Phase L Scheduled tab → row → Edit  (legacy bridge)

  Backend contract (anchor — see api/tasks.js + autotasks/views.py):
    - POST /tasks/   { agent: <agent_id>, task_type, actions, ... }
    - PUT  /tasks/<id>/  { ...partial }
    - DEL  /tasks/<id>/
    - POST /tasks/<id>/run/  { agent_id?: <id> }   (run-now)

  Field shape (verified against autotasks/models.py + serializers.py):

    actions: JSONField list of either
      { type: "script", script: <id>, script_args: [...], env_vars: [...], timeout: 90 }
      { type: "cmd",    command: "...", shell: "cmd|powershell|<custom>", timeout: 90 }

    task_type: one of
      manual         — only fires when something else triggers it
      runonce        — single run at run_time_date
      daily          — daily_interval + run_time_date (time)
      weekly         — weekly_interval + run_time_bit_weekdays + run_time_date (time)
      monthly        — monthly_months_of_year + monthly_days_of_month + run_time_date
      monthlydow     — monthly_months_of_year + monthly_weeks_of_month +
                       run_time_bit_weekdays + run_time_date
      checkfailure   — assigned_check (per-target check id)

  Shared fields:
    name, alert_severity, enabled, continue_on_error,
    dashboard_alert, email_alert, text_alert,
    expire_date (optional), random_task_delay (optional, ISO duration)

  KARPATHY DECISIONS (pinned with reasons so future phases don't litigate):
    1. The brief's "Built-in command vs Script task" picker is per-action,
       not per-task. AutomatedTask supports a list of mixed actions; we
       keep that and let the user add/remove rows.
    2. Phase N keeps action editing single-action by default — most tasks
       have one action. Multi-action support is exposed via "Add action"
       so we don't lose the upstream capability.
    3. The brief's "fail-N-then-alert" threshold doesn't exist on the
       Task model; alert_severity + the three boolean alert toggles drive
       notifications. Phase P (alerts) owns AlertTemplate.
    4. The brief's "interval / every N minutes" task type doesn't exist —
       Windows Task Scheduler doesn't expose sub-daily intervals at the
       trigger level (it does support repetition_interval but that's a
       refinement). We expose run_time_date + (daily/weekly/monthly...)
       and map "Every N days at HH:MM" to daily_interval.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
    position="right"
    full-height
  >
    <q-card class="te">
      <q-card-section class="te__head">
        <div>
          <div class="te__title">{{ isEdit ? "Edit task" : "Add task" }}</div>
          <div class="te__sub">{{ targetLabel }}</div>
        </div>
        <q-space />
        <q-btn flat dense round icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="te__body">
        <!-- ── Identity ── -->
        <div class="te__row">
          <q-input
            v-model="form.name"
            outlined dense
            label="Task name"
            class="te__col te__col--grow"
            :rules="[(v) => (v && v.trim()) || 'Required']"
            hide-bottom-space
          />
          <q-select
            v-model="form.alert_severity"
            :options="SEVERITY_OPTIONS"
            map-options emit-value
            outlined dense
            label="Severity"
            class="te__col"
          />
        </div>

        <div class="te__row te__row--toggles">
          <q-toggle v-model="form.enabled" label="Enabled" />
          <q-toggle v-model="form.continue_on_error" label="Continue on error" />
          <q-toggle v-model="form.dashboard_alert" label="Dashboard alert" />
          <q-toggle v-model="form.email_alert"     label="Email alert" />
          <q-toggle v-model="form.text_alert"      label="SMS alert" />
        </div>

        <q-separator />

        <!-- ── Actions ── -->
        <div class="te__section">
          <div class="te__section-title">
            Actions
            <q-btn
              flat dense no-caps icon="add" label="Add action"
              size="sm" color="primary"
              @click="addAction"
            />
          </div>
          <div class="te__hint">
            Each action is either a script (from your library) or a raw command. Actions run in order.
          </div>

          <div
            v-for="(act, idx) in form.actions"
            :key="`act-${idx}`"
            class="te__action"
          >
            <header class="te__action-head">
              <q-btn-toggle
                v-model="act.type"
                :options="[
                  { value: 'script', label: 'Script' },
                  { value: 'cmd',    label: 'Command' },
                ]"
                toggle-color="primary"
                outline
                no-caps
                dense
                @update:model-value="(t) => onActionTypeChange(act, t)"
              />
              <q-space />
              <q-btn
                flat dense round icon="delete"
                :disable="form.actions.length <= 1"
                @click="removeAction(idx)"
              >
                <q-tooltip>Remove action</q-tooltip>
              </q-btn>
            </header>

            <!-- Script action -->
            <template v-if="act.type === 'script'">
              <div class="te__row">
                <div class="te__col te__col--grow">
                  <div class="te__field-label">Script</div>
                  <div class="te__script-pick">
                    <span class="te__script-name">
                      {{ act.scriptName || "No script selected" }}
                    </span>
                    <q-btn
                      flat dense no-caps icon="search"
                      :label="act.scriptName ? 'Change' : 'Pick script…'"
                      color="primary"
                      @click="openPickerForAction(idx)"
                    />
                  </div>
                </div>
              </div>
              <div class="te__row">
                <q-input
                  v-model="act.argsRaw"
                  outlined dense autogrow :input-style="{ minHeight: '52px' }"
                  label="Script arguments (one per line)"
                  class="te__col te__col--grow"
                />
              </div>
              <div class="te__row">
                <q-input
                  v-model="act.envRaw"
                  outlined dense autogrow :input-style="{ minHeight: '52px' }"
                  label="Env vars (KEY=value, one per line)"
                  class="te__col te__col--grow"
                />
              </div>
              <div class="te__row">
                <q-input
                  v-model.number="act.timeout"
                  outlined dense type="number" min="10"
                  label="Timeout (s)"
                  class="te__col"
                />
              </div>
            </template>

            <!-- Command action -->
            <template v-else>
              <div class="te__row">
                <q-input
                  v-model="act.command"
                  outlined dense autogrow :input-style="{ minHeight: '52px' }"
                  label="Command"
                  class="te__col te__col--grow"
                />
              </div>
              <div class="te__row">
                <q-select
                  v-model="act.shell"
                  :options="SHELL_OPTIONS"
                  map-options emit-value
                  outlined dense
                  label="Shell"
                  class="te__col"
                />
                <q-input
                  v-model.number="act.timeout"
                  outlined dense type="number" min="10"
                  label="Timeout (s)"
                  class="te__col"
                />
              </div>
            </template>
          </div>
        </div>

        <q-separator />

        <!-- ── Schedule ── -->
        <div class="te__section">
          <div class="te__section-title">Schedule</div>

          <div class="te__row">
            <q-select
              v-model="form.task_type"
              :options="TASK_TYPE_OPTIONS"
              map-options emit-value
              outlined dense
              label="Schedule type"
              class="te__col te__col--grow"
              :disable="isEdit"
            />
          </div>

          <!-- Manual / Onboarding — no extra fields -->
          <div v-if="form.task_type === 'manual'" class="te__hint">
            The task only runs when triggered manually (Run-now or by a check failure).
          </div>

          <!-- runonce / daily / weekly / monthly / monthlydow share the date+time pickers -->
          <template v-if="needsDate">
            <div class="te__row">
              <q-input
                v-model="dateInput"
                outlined dense type="date"
                label="Date"
                class="te__col"
              />
              <q-input
                v-model="timeInput"
                outlined dense type="time"
                label="Time (24h)"
                class="te__col"
              />
            </div>
          </template>

          <!-- daily -->
          <template v-if="form.task_type === 'daily'">
            <div class="te__row">
              <q-input
                v-model.number="form.daily_interval"
                outlined dense type="number" min="1" max="255"
                label="Repeat every N days"
                class="te__col"
              />
            </div>
          </template>

          <!-- weekly -->
          <template v-if="form.task_type === 'weekly'">
            <div class="te__row">
              <q-input
                v-model.number="form.weekly_interval"
                outlined dense type="number" min="1" max="52"
                label="Repeat every N weeks"
                class="te__col"
              />
            </div>
            <div class="te__row te__row--toggles te__row--wrap">
              <q-checkbox
                v-for="d in WEEK_DAYS"
                :key="d.bit"
                :model-value="(form.run_time_bit_weekdays & d.bit) !== 0"
                :label="d.short"
                dense
                @update:model-value="toggleWeekday(d.bit, $event)"
              />
            </div>
          </template>

          <!-- monthly + monthlydow share the months picker -->
          <template v-if="form.task_type === 'monthly' || form.task_type === 'monthlydow'">
            <div class="te__field-label">Months</div>
            <div class="te__row te__row--toggles te__row--wrap">
              <q-checkbox
                v-for="m in MONTHS"
                :key="m.bit"
                :model-value="(form.monthly_months_of_year & m.bit) !== 0"
                :label="m.short"
                dense
                @update:model-value="toggleMonth(m.bit, $event)"
              />
            </div>
          </template>

          <!-- monthly: days of month -->
          <template v-if="form.task_type === 'monthly'">
            <div class="te__field-label">Days of month</div>
            <div class="te__row te__row--toggles te__row--wrap">
              <q-chip
                v-for="day in 31"
                :key="`d${day}`"
                :selected="(form.monthly_days_of_month & (1 << (day - 1))) !== 0"
                outline
                clickable
                square
                size="sm"
                color="primary"
                @click="toggleMonthDay(day - 1)"
              >
                {{ day }}
              </q-chip>
              <q-chip
                :selected="(form.monthly_days_of_month & 0x80000000) !== 0"
                outline clickable square size="sm" color="primary"
                @click="toggleLastDay"
              >Last</q-chip>
            </div>
          </template>

          <!-- monthlydow: weeks of month + weekdays -->
          <template v-if="form.task_type === 'monthlydow'">
            <div class="te__field-label">Weeks of month</div>
            <div class="te__row te__row--toggles te__row--wrap">
              <q-checkbox
                v-for="w in WEEKS_OF_MONTH"
                :key="w.bit"
                :model-value="(form.monthly_weeks_of_month & w.bit) !== 0"
                :label="w.name"
                dense
                @update:model-value="toggleWeekOfMonth(w.bit, $event)"
              />
            </div>
            <div class="te__field-label">Days of week</div>
            <div class="te__row te__row--toggles te__row--wrap">
              <q-checkbox
                v-for="d in WEEK_DAYS"
                :key="`mdow-${d.bit}`"
                :model-value="(form.run_time_bit_weekdays & d.bit) !== 0"
                :label="d.short"
                dense
                @update:model-value="toggleWeekday(d.bit, $event)"
              />
            </div>
          </template>

          <!-- checkfailure -->
          <template v-if="form.task_type === 'checkfailure'">
            <div v-if="checkOptions.length === 0" class="te__hint">
              No checks defined for this target — add a check first, then this task can fire on its failure.
            </div>
            <div v-else class="te__row">
              <q-select
                v-model="form.assigned_check"
                :options="checkOptions"
                map-options emit-value
                outlined dense
                label="Trigger when this check fails"
                class="te__col te__col--grow"
              />
            </div>
          </template>

          <!-- Schedule preview -->
          <div class="te__schedule-preview">
            <q-icon name="schedule" size="14px" />
            <span>{{ schedulePreview }}</span>
          </div>
        </div>

        <!-- Validation summary -->
        <div v-if="validationError" class="te__error">
          <q-icon name="error_outline" />
          <span>{{ validationError }}</span>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="te__actions">
        <q-btn
          v-if="isEdit"
          flat no-caps color="primary"
          icon="play_arrow"
          label="Run now"
          :loading="running"
          :disable="saving"
          @click="onRunNow"
        />
        <q-space />
        <q-btn flat label="Cancel" v-close-popup :disable="saving" />
        <q-btn
          unelevated
          color="primary"
          :label="isEdit ? 'Save changes' : 'Create task'"
          :loading="saving"
          @click="onSave"
        />
      </q-card-actions>

      <ScriptPickerModal
        v-model="openScriptPicker"
        mode="select"
        :initial-script-id="pickerActionScriptId"
        @select="onScriptSelected"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import {
  fetchTask,
  saveTask as apiSaveTask,
  updateTask as apiUpdateTask,
  runTask as apiRunTask,
} from "@/api/tasks";
import { fetchScripts } from "@/api/scripts";
import { fetchAgentChecks } from "@/api/agents";
import ScriptPickerModal from "@/components/scripts/ScriptPickerModal.vue";
import { notifySuccess, notifyError } from "@/utils/notify";
import {
  WEEK_DAYS, MONTHS, WEEKS_OF_MONTH,
  TASK_TYPE_OPTIONS, formatSchedule,
} from "./scheduleHelpers.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // edit-mode: pass an existing task pk; create-mode: leave null + pass
  // EITHER agentId (agent-target task) OR policyId (policy-target task).
  taskId: { type: Number, default: null },
  agentId: { type: String, default: "" },
  agentLabel: { type: String, default: "" },
  // Phase O: policy-target tasks (drawer reused by /policies/:id).
  policyId: { type: Number, default: null },
  policyLabel: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "saved", "ran"]);

const isEdit = computed(() => !!props.taskId);

const targetLabel = computed(() => {
  if (props.policyId)   return `Policy: ${props.policyLabel || `#${props.policyId}`}`;
  if (props.agentLabel) return `Agent: ${props.agentLabel}`;
  if (props.agentId)    return `Agent: ${props.agentId}`;
  return "—";
});

const SEVERITY_OPTIONS = [
  { value: "info",    label: "Informational" },
  { value: "warning", label: "Warning" },
  { value: "error",   label: "Error" },
];
const SHELL_OPTIONS = [
  { value: "cmd",        label: "CMD" },
  { value: "powershell", label: "PowerShell" },
];

// ─── form state ────────────────────────────────────────────────────────
function blankAction(type = "script") {
  if (type === "cmd") {
    return { type: "cmd", command: "", shell: "cmd", timeout: 90 };
  }
  return {
    type: "script",
    script: null,
    scriptName: "",
    argsRaw: "",
    envRaw: "",
    timeout: 90,
  };
}

function blankForm() {
  return {
    name: "",
    enabled: true,
    continue_on_error: true,
    alert_severity: "info",
    dashboard_alert: false,
    email_alert: false,
    text_alert: false,

    actions: [blankAction("script")],

    task_type: "manual",
    run_time_date: null,        // ISO datetime string
    expire_date: null,
    daily_interval: 1,
    weekly_interval: 1,
    run_time_bit_weekdays: 0,
    monthly_months_of_year: 0,
    monthly_days_of_month: 0,
    monthly_weeks_of_month: 0,
    assigned_check: null,
  };
}

const form = ref(blankForm());
const validationError = ref("");
const saving = ref(false);
const running = ref(false);
const dateInput = ref("");   // YYYY-MM-DD
const timeInput = ref("");   // HH:mm
const checkOptions = ref([]);

// schedule types that need the date+time pickers visible
const needsDate = computed(() =>
  ["runonce", "daily", "weekly", "monthly", "monthlydow"].includes(form.value.task_type),
);

// keep run_time_date in sync with the date+time inputs
watch([dateInput, timeInput], ([d, t]) => {
  if (!d || !t) {
    // for runonce we require both; for daily/weekly/monthly only time matters
    // — but the model wants a full datetime, so we synthesise today's date
    // when the user only picks a time.
    if (t && !d) {
      const today = new Date();
      d = today.toISOString().slice(0, 10);
    } else {
      return;
    }
  }
  if (!t) t = "00:00";
  // local time — let the browser decide tz, then ISO it.
  const dt = new Date(`${d}T${t}:00`);
  if (!Number.isNaN(dt.getTime())) {
    form.value.run_time_date = dt.toISOString();
  }
});

// schedule preview string — driven by the form state itself.
const schedulePreview = computed(() => {
  return formatSchedule({
    task_type: form.value.task_type,
    run_time_date: form.value.run_time_date,
    daily_interval: form.value.daily_interval,
    weekly_interval: form.value.weekly_interval,
    run_time_bit_weekdays: form.value.run_time_bit_weekdays,
    monthly_months_of_year: form.value.monthly_months_of_year,
    monthly_days_of_month: form.value.monthly_days_of_month,
    monthly_weeks_of_month: form.value.monthly_weeks_of_month,
  });
});

// ─── actions list ──────────────────────────────────────────────────────
function addAction() {
  form.value.actions.push(blankAction("script"));
}
function removeAction(idx) {
  if (form.value.actions.length <= 1) return;
  form.value.actions.splice(idx, 1);
}
function onActionTypeChange(act, t) {
  // type-toggle is bound to act.type already; but we need to reshape fields
  // when switching so we don't carry orphan keys to the backend.
  if (t === "cmd") {
    Object.assign(act, blankAction("cmd"));
  } else {
    Object.assign(act, blankAction("script"));
  }
}

// ─── script picker ─────────────────────────────────────────────────────
const openScriptPicker = ref(false);
const pickerActionIdx = ref(null);
const pickerActionScriptId = computed(() => {
  if (pickerActionIdx.value == null) return null;
  return form.value.actions[pickerActionIdx.value]?.script ?? null;
});

function openPickerForAction(idx) {
  pickerActionIdx.value = idx;
  openScriptPicker.value = true;
}
function onScriptSelected({ script }) {
  const idx = pickerActionIdx.value;
  if (idx == null) return;
  const act = form.value.actions[idx];
  if (!act) return;
  act.script = script.id;
  act.scriptName = script.name;
  openScriptPicker.value = false;
  pickerActionIdx.value = null;
}

// ─── bit-mask toggles ──────────────────────────────────────────────────
function toggleWeekday(bit, on) {
  if (on) form.value.run_time_bit_weekdays |= bit;
  else    form.value.run_time_bit_weekdays &= ~bit;
}
function toggleMonth(bit, on) {
  if (on) form.value.monthly_months_of_year |= bit;
  else    form.value.monthly_months_of_year &= ~bit;
}
function toggleWeekOfMonth(bit, on) {
  if (on) form.value.monthly_weeks_of_month |= bit;
  else    form.value.monthly_weeks_of_month &= ~bit;
}
function toggleMonthDay(idx0) {
  // bit 0 = day 1, bit 30 = day 31. Stored as int. JS bitwise is 32-bit
  // signed — values > 0x7fffffff are negative; we use unsigned arithmetic.
  const bit = 1 << idx0;
  if (form.value.monthly_days_of_month & bit) {
    form.value.monthly_days_of_month &= ~bit;
  } else {
    form.value.monthly_days_of_month |= bit;
  }
}
function toggleLastDay() {
  // 0x80000000 doesn't roundtrip through JS bitwise (sign bit). Use
  // unsigned math: subtract / add directly.
  if (form.value.monthly_days_of_month >= 0x80000000) {
    form.value.monthly_days_of_month -= 0x80000000;
  } else {
    form.value.monthly_days_of_month += 0x80000000;
  }
}

// ─── load existing task in edit mode ───────────────────────────────────
async function loadTask() {
  if (!props.taskId) return;
  try {
    const data = await fetchTask(props.taskId);
    Object.assign(form.value, {
      name: data.name || "",
      enabled: !!data.enabled,
      continue_on_error: !!data.continue_on_error,
      alert_severity: data.alert_severity || "info",
      dashboard_alert: !!data.dashboard_alert,
      email_alert: !!data.email_alert,
      text_alert: !!data.text_alert,
      task_type: data.task_type || "manual",
      run_time_date: data.run_time_date || null,
      expire_date: data.expire_date || null,
      daily_interval: data.daily_interval || 1,
      weekly_interval: data.weekly_interval || 1,
      run_time_bit_weekdays: data.run_time_bit_weekdays || 0,
      monthly_months_of_year: data.monthly_months_of_year || 0,
      monthly_days_of_month: data.monthly_days_of_month || 0,
      monthly_weeks_of_month: data.monthly_weeks_of_month || 0,
      assigned_check: data.assigned_check || null,
    });
    // hydrate actions — Phase N drops orphans (stored backend-side as
    // raw JSON list). Prefill the editor mirrors.
    const actsIn = Array.isArray(data.actions) ? data.actions : [];
    form.value.actions = actsIn.length ? actsIn.map(hydrateAction) : [blankAction("script")];

    // Backfill display names for script actions — single fetch, then map.
    const scriptIds = form.value.actions
      .filter((a) => a.type === "script" && a.script)
      .map((a) => a.script);
    if (scriptIds.length) {
      try {
        const all = await fetchScripts();
        const byId = new Map((all || []).map((s) => [s.id, s.name]));
        for (const a of form.value.actions) {
          if (a.type === "script" && a.script && byId.has(a.script)) {
            a.scriptName = byId.get(a.script);
          }
        }
      } catch { /* not fatal */ }
    }

    // Sync the date/time inputs from run_time_date.
    if (data.run_time_date) {
      const dt = new Date(data.run_time_date);
      if (!Number.isNaN(dt.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        dateInput.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        timeInput.value = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      }
    }
  } catch (e) {
    notifyError(`Couldn't load task: ${e?.response?.data?.detail || e?.message || "Unknown error"}`);
    emit("update:modelValue", false);
  }
}

function hydrateAction(a) {
  if (a.type === "cmd") {
    return {
      type: "cmd",
      command: a.command || "",
      shell: a.shell || "cmd",
      timeout: a.timeout || 90,
    };
  }
  return {
    type: "script",
    script: a.script ?? null,
    scriptName: "",
    argsRaw: Array.isArray(a.script_args) ? a.script_args.join("\n") : "",
    envRaw: Array.isArray(a.env_vars) ? a.env_vars.join("\n") : "",
    timeout: a.timeout || 90,
  };
}

// ─── load checks (for checkfailure type) ──────────────────────────────
async function loadAgentChecks() {
  if (!props.agentId) return;
  try {
    const data = await fetchAgentChecks(props.agentId);
    checkOptions.value = (Array.isArray(data) ? data : []).map((c) => ({
      value: c.id,
      label: c.name || c.readable_desc || `Check #${c.id}`,
    }));
  } catch { /* non-fatal — UI shows "no checks" hint */ }
}

watch(
  () => [props.modelValue, props.taskId],
  async ([open, id]) => {
    if (!open) return;
    validationError.value = "";
    if (id) {
      form.value = blankForm();
      await loadTask();
    } else {
      form.value = blankForm();
      dateInput.value = "";
      timeInput.value = "";
    }
    await loadAgentChecks();
  },
  { immediate: true },
);

// ─── validation + save ────────────────────────────────────────────────
function parseLines(s) {
  return (s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function buildPayload() {
  const t = form.value.task_type;
  const out = {
    name: form.value.name?.trim(),
    task_type: t,
    enabled: !!form.value.enabled,
    continue_on_error: !!form.value.continue_on_error,
    alert_severity: form.value.alert_severity,
    dashboard_alert: !!form.value.dashboard_alert,
    email_alert: !!form.value.email_alert,
    text_alert: !!form.value.text_alert,
  };

  // Actions — flatten editor mirrors into the upstream JSON shape.
  out.actions = form.value.actions.map((a) => {
    if (a.type === "cmd") {
      return {
        type: "cmd",
        command: a.command || "",
        shell: a.shell || "cmd",
        timeout: Number(a.timeout) || 90,
      };
    }
    return {
      type: "script",
      script: a.script,
      script_args: parseLines(a.argsRaw),
      env_vars: parseLines(a.envRaw),
      timeout: Number(a.timeout) || 90,
    };
  });

  // Schedule fields — only ship fields the backend cares about for this type.
  if (t === "runonce" || t === "daily" || t === "weekly" || t === "monthly" || t === "monthlydow") {
    out.run_time_date = form.value.run_time_date;
  }
  if (t === "daily") {
    out.daily_interval = Number(form.value.daily_interval) || 1;
  }
  if (t === "weekly") {
    out.weekly_interval = Number(form.value.weekly_interval) || 1;
    out.run_time_bit_weekdays = form.value.run_time_bit_weekdays || 0;
  }
  if (t === "monthly") {
    out.monthly_months_of_year = form.value.monthly_months_of_year || 0;
    out.monthly_days_of_month = form.value.monthly_days_of_month || 0;
  }
  if (t === "monthlydow") {
    out.monthly_months_of_year = form.value.monthly_months_of_year || 0;
    out.monthly_weeks_of_month = form.value.monthly_weeks_of_month || 0;
    out.run_time_bit_weekdays = form.value.run_time_bit_weekdays || 0;
  }
  if (t === "checkfailure") {
    out.assigned_check = form.value.assigned_check;
  }

  // Create-mode only — backend reads either agent or policy on create.
  if (!isEdit.value) {
    if (props.policyId) {
      out.policy = props.policyId;
    } else if (props.agentId) {
      out.agent = props.agentId;
    }
  }

  return out;
}

function clientSideValidate(p) {
  if (!p.name) return "Task name is required.";
  if (!p.actions || p.actions.length === 0) return "Add at least one action.";
  for (const [i, a] of p.actions.entries()) {
    if (a.type === "script" && !a.script) {
      return `Action #${i + 1}: pick a script or switch to a command action.`;
    }
    if (a.type === "cmd" && !a.command?.trim()) {
      return `Action #${i + 1}: command is required.`;
    }
  }
  if (p.task_type === "runonce" || p.task_type === "daily" ||
      p.task_type === "weekly" || p.task_type === "monthly" ||
      p.task_type === "monthlydow") {
    if (!p.run_time_date) return "Pick a date and time.";
  }
  if (p.task_type === "weekly") {
    if (!p.run_time_bit_weekdays) return "Pick at least one weekday.";
  }
  if (p.task_type === "monthly") {
    if (!p.monthly_months_of_year) return "Pick at least one month.";
    if (!p.monthly_days_of_month) return "Pick at least one day of the month.";
  }
  if (p.task_type === "monthlydow") {
    if (!p.monthly_months_of_year) return "Pick at least one month.";
    if (!p.monthly_weeks_of_month) return "Pick at least one week of the month.";
    if (!p.run_time_bit_weekdays) return "Pick at least one weekday.";
  }
  if (p.task_type === "checkfailure" && !p.assigned_check) {
    return "Pick the check whose failure should trigger this task.";
  }
  return "";
}

async function onSave() {
  validationError.value = "";
  const payload = buildPayload();
  const err = clientSideValidate(payload);
  if (err) { validationError.value = err; return; }

  saving.value = true;
  try {
    const res = isEdit.value
      ? await apiUpdateTask(props.taskId, payload)
      : await apiSaveTask(payload);
    notifySuccess(typeof res === "string" ? res : "Saved");
    emit("saved", { id: props.taskId, payload });
    emit("update:modelValue", false);
  } catch (e) {
    const msg =
      e?.response?.data?.non_field_errors?.[0] ||
      e?.response?.data?.detail ||
      (typeof e?.response?.data === "string" ? e.response.data : "") ||
      e?.message ||
      "Save failed";
    validationError.value = msg;
  }
  saving.value = false;
}

async function onRunNow() {
  if (!isEdit.value || !props.taskId) return;
  running.value = true;
  try {
    const res = await apiRunTask(props.taskId);
    notifySuccess(typeof res === "string" ? res : "Run dispatched");
    emit("ran", { id: props.taskId });
  } catch (e) {
    notifyError(e?.response?.data?.detail || e?.message || "Run failed");
  }
  running.value = false;
}
</script>

<style lang="scss" scoped>
.te {
  width: min(680px, 95vw);
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
  }
  &__title {
    font-size: var(--intune-font-size-500, 18px);
    font-weight: var(--intune-font-weight-semibold, 600);
  }
  &__sub {
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin-top: 2px;
  }
  &__body {
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  &__section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    &--toggles {
      gap: 18px;
      align-items: center;
    }
    &--wrap {
      gap: 8px 14px;
    }
  }
  &__col {
    flex: 1 1 200px;
    min-width: 180px;
    &--grow { flex: 1 1 100%; }
  }
  &__hint {
    font-size: 12px;
    color: var(--color-fg-secondary);
    padding-left: 4px;
  }
  &__field-label {
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__action {
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 10px 12px 4px;
    background: var(--color-bg-page);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  &__action-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__script-pick {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
  }
  &__script-name {
    font-family: var(--intune-font-mono, monospace);
    font-size: 13px;
    color: var(--color-fg-primary);
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__schedule-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--color-bg-page);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    font-size: 12.5px;
    color: var(--color-fg-secondary);
    font-family: var(--intune-font-mono, monospace);
    align-self: flex-start;
    max-width: 100%;
  }

  &__error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-state-negative-fg, #a40e26);
    background: var(--color-state-negative-bg, #fde7e9);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  &__actions {
    padding: 12px 18px;
  }
}
</style>
