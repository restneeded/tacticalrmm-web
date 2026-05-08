<!--
  CheckEditor — Phase M central editor for all 7 TRMM check types.

  Mounted as a side drawer from:
    1. Agent Detail Checks tab          (target = { agent: agentId })
    2. /checks Library tab "Add check"  (target = { agent: agentId } via picker)
    3. /checks Library tab row → edit   (existing check pk)

  Backend contract (anchor — see api/checks.js + checks/views.py):
    - POST /checks/   { agent: <agent_id>, check_type, ... }
    - PUT  /checks/<id>/  { ...partial }
    - DEL  /checks/<id>/

  Field shape per type (verified against checks/models.py & serializers.py):
    diskspace : disk, warning_threshold, error_threshold
    cpuload   : warning_threshold, error_threshold
    memory    : warning_threshold, error_threshold
    ping      : ip
    winsvc    : svc_name, svc_display_name, pass_if_start_pending,
                pass_if_svc_not_exist, restart_if_stopped
    script    : script (id), script_args, env_vars, timeout,
                info_return_codes, warning_return_codes
    eventlog  : log_name, event_id, event_id_is_wildcard, event_type,
                event_source, event_message, fail_when, search_last_days,
                number_of_events_b4_alert

  Shared header fields (all types):
    name, alert_severity, fails_b4_alert, run_interval, dashboard_alert,
    email_alert, text_alert.

  KARPATHY NOTES:
    - "enabled" toggle in the brief is dropped — the Check model has no
      enabled field. Reset-status (per-CheckResult) is the closest concept
      and lives on the row in the parent table, not in this editor.
    - "Web URL" check from the brief is dropped — TRMM has no such CheckType.
    - Per-check "Run now" doesn't exist as a backend endpoint either; the
      parent ChecksTab fires the agent-level runchecks instead.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
    position="right"
    full-height
  >
    <q-card class="ce">
      <q-card-section class="ce__head">
        <div>
          <div class="ce__title">{{ isEdit ? "Edit check" : "Add check" }}</div>
          <div class="ce__sub">{{ targetLabel }}</div>
        </div>
        <q-space />
        <q-btn flat dense round icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="ce__body">
        <!-- Type picker (locked in edit mode — switching type would
             invalidate most fields and the backend doesn't allow it). -->
        <div class="ce__row">
          <q-select
            v-model="form.check_type"
            :options="CHECK_TYPE_OPTIONS"
            map-options
            emit-value
            outlined
            dense
            label="Check type"
            class="ce__col"
            :disable="isEdit"
          />
        </div>

        <!-- Shared identity / scheduling fields. -->
        <div class="ce__row">
          <q-input
            v-model="form.name"
            outlined
            dense
            label="Name"
            class="ce__col ce__col--grow"
            :rules="[(v) => (v && v.trim()) || 'Required']"
            hide-bottom-space
          />
          <q-select
            v-model="form.alert_severity"
            :options="SEVERITY_OPTIONS"
            map-options
            emit-value
            outlined
            dense
            label="Severity"
            class="ce__col"
          />
        </div>

        <div class="ce__row">
          <q-select
            v-model="form.fails_b4_alert"
            :options="FAIL_OPTIONS"
            outlined
            dense
            label="Fail count before alert"
            class="ce__col"
          />
          <q-input
            v-model.number="form.run_interval"
            outlined
            dense
            type="number"
            label="Run interval (seconds, 0 = default)"
            class="ce__col"
            min="0"
          />
        </div>

        <div class="ce__row ce__row--toggles">
          <q-toggle v-model="form.dashboard_alert" label="Dashboard alert" />
          <q-toggle v-model="form.email_alert"     label="Email alert" />
          <q-toggle v-model="form.text_alert"      label="SMS alert" />
        </div>

        <q-separator />

        <!-- ============= TYPE-SPECIFIC FORMS ============= -->

        <!-- Disk space -->
        <template v-if="form.check_type === 'diskspace'">
          <div class="ce__row">
            <q-select
              v-model="form.disk"
              :options="diskOptions"
              outlined
              dense
              label="Drive"
              class="ce__col"
              :loading="loadingMeta"
              use-input
              fill-input
              hide-selected
              new-value-mode="add-unique"
              hint="Type a custom drive letter (e.g. D:) if not listed"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model.number="form.warning_threshold"
              outlined dense type="number" min="0" max="99"
              label="Warning when free space below (%)"
              class="ce__col"
            />
            <q-input
              v-model.number="form.error_threshold"
              outlined dense type="number" min="0" max="99"
              label="Error when free space below (%)"
              class="ce__col"
            />
          </div>
        </template>

        <!-- CPU load / Memory — same shape -->
        <template v-else-if="form.check_type === 'cpuload' || form.check_type === 'memory'">
          <div class="ce__row">
            <q-input
              v-model.number="form.warning_threshold"
              outlined dense type="number" min="0" max="99"
              label="Warning above (%)"
              class="ce__col"
            />
            <q-input
              v-model.number="form.error_threshold"
              outlined dense type="number" min="0" max="99"
              label="Error above (%)"
              class="ce__col"
            />
          </div>
          <div class="ce__hint">
            Average is computed over the last 15 samples (≈ 15 × run-interval seconds).
          </div>
        </template>

        <!-- Ping -->
        <template v-else-if="form.check_type === 'ping'">
          <div class="ce__row">
            <q-input
              v-model="form.ip"
              outlined dense
              label="Target hostname or IP"
              class="ce__col ce__col--grow"
              :rules="[(v) => (v && v.trim()) || 'Required']"
              hide-bottom-space
            />
          </div>
        </template>

        <!-- Windows Service -->
        <template v-else-if="form.check_type === 'winsvc'">
          <div class="ce__row">
            <q-select
              v-model="serviceSelectModel"
              :options="serviceOptions"
              outlined
              dense
              label="Service"
              class="ce__col ce__col--grow"
              :loading="loadingMeta"
              use-input
              hide-selected
              fill-input
              input-debounce="100"
              :option-value="(o) => o?.value"
              :option-label="(o) => o?.label"
              emit-value
              map-options
              @filter="filterServices"
              @update:model-value="onPickService"
            />
          </div>
          <div class="ce__row ce__row--toggles">
            <q-toggle v-model="form.pass_if_start_pending"  label="Pass if start-pending" />
            <q-toggle v-model="form.pass_if_svc_not_exist"  label="Pass if service missing" />
            <q-toggle v-model="form.restart_if_stopped"     label="Restart if stopped" />
          </div>
        </template>

        <!-- Script -->
        <template v-else-if="form.check_type === 'script'">
          <div class="ce__row ce__row--script">
            <div class="ce__col ce__col--grow">
              <div class="ce__field-label">Script</div>
              <div class="ce__script-pick">
                <span class="ce__script-name">
                  {{ scriptDisplayName || "No script selected" }}
                </span>
                <q-btn flat dense no-caps
                       icon="search"
                       :label="scriptDisplayName ? 'Change' : 'Pick script…'"
                       color="primary"
                       @click="openScriptPicker = true" />
              </div>
            </div>
          </div>
          <div class="ce__row">
            <q-input
              v-model="scriptArgsRaw"
              outlined dense autogrow :input-style="{ minHeight: '52px' }"
              label="Script arguments (one per line)"
              class="ce__col ce__col--grow"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model="envVarsRaw"
              outlined dense autogrow :input-style="{ minHeight: '52px' }"
              label="Env vars (KEY=value, one per line)"
              class="ce__col ce__col--grow"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model.number="form.timeout"
              outlined dense type="number" min="10"
              label="Timeout (s)"
              class="ce__col"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model="infoCodesRaw"
              outlined dense
              label="Info exit codes (comma-separated)"
              class="ce__col"
            />
            <q-input
              v-model="warnCodesRaw"
              outlined dense
              label="Warning exit codes (comma-separated)"
              class="ce__col"
            />
          </div>

          <ScriptPickerModal
            v-model="openScriptPicker"
            mode="select"
            :initial-script-id="form.script ?? null"
            @select="onScriptSelected"
          />
        </template>

        <!-- Event Log -->
        <template v-else-if="form.check_type === 'eventlog'">
          <div class="ce__row">
            <q-select
              v-model="form.log_name"
              :options="LOG_NAME_OPTIONS"
              outlined dense
              label="Log name"
              class="ce__col"
              use-input
              fill-input
              hide-selected
              new-value-mode="add-unique"
              hint="Pick or type a custom log name"
            />
            <q-select
              v-model="form.event_type"
              :options="EVT_TYPE_OPTIONS"
              map-options
              emit-value
              outlined dense
              label="Event type"
              class="ce__col"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model.number="form.event_id"
              outlined dense type="number"
              label="Event ID"
              class="ce__col"
              :disable="form.event_id_is_wildcard"
            />
            <div class="ce__col ce__col--toggle">
              <q-toggle v-model="form.event_id_is_wildcard" label="Wildcard event ID" />
            </div>
          </div>
          <div class="ce__row">
            <q-input
              v-model="form.event_source"
              outlined dense
              label="Event source (optional)"
              class="ce__col ce__col--grow"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model="form.event_message"
              outlined dense autogrow :input-style="{ minHeight: '52px' }"
              label="Search text in message body (optional)"
              class="ce__col ce__col--grow"
            />
          </div>
          <div class="ce__row">
            <q-select
              v-model="form.fail_when"
              :options="FAIL_WHEN_OPTIONS"
              map-options
              emit-value
              outlined dense
              label="Fail when…"
              class="ce__col"
            />
            <q-input
              v-model.number="form.search_last_days"
              outlined dense type="number" min="0"
              label="Look back (days, 0 = since last run)"
              class="ce__col"
            />
          </div>
          <div class="ce__row">
            <q-input
              v-model.number="form.number_of_events_b4_alert"
              outlined dense type="number" min="1"
              label="Matching events before alert"
              class="ce__col"
            />
          </div>
        </template>

        <!-- Validation summary -->
        <div v-if="validationError" class="ce__error">
          <q-icon name="error_outline" />
          <span>{{ validationError }}</span>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="ce__actions">
        <q-btn flat label="Cancel" v-close-popup :disable="saving" />
        <q-btn
          unelevated
          color="primary"
          :label="isEdit ? 'Save changes' : 'Create check'"
          :loading="saving"
          @click="onSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { fetchAgent } from "@/api/agents";
import {
  saveCheck as apiSaveCheck,
  updateCheck as apiUpdateCheck,
  fetchCheck,
} from "@/api/checks";
import { fetchScripts } from "@/api/scripts";
import ScriptPickerModal from "@/components/scripts/ScriptPickerModal.vue";
import { notifySuccess, notifyError } from "@/utils/notify";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // edit-mode: pass an existing check id; create-mode: leave null and pass
  // EITHER agentId (agent-target check) OR policyId (policy-target check).
  checkId: { type: Number, default: null },
  agentId: { type: String, default: "" },
  agentLabel: { type: String, default: "" },
  // Phase O: policy-target checks (drawer reused by /policies/:id).
  policyId: { type: Number, default: null },
  policyLabel: { type: String, default: "" },
  // create-mode: pre-pick a check_type when opening (e.g. "Add disk space check").
  initialCheckType: { type: String, default: "diskspace" },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const isEdit = computed(() => !!props.checkId);

const targetLabel = computed(() => {
  if (props.policyId)   return `Policy: ${props.policyLabel || `#${props.policyId}`}`;
  if (props.agentLabel) return `Agent: ${props.agentLabel}`;
  if (props.agentId)    return `Agent: ${props.agentId}`;
  return "—";
});

const CHECK_TYPE_OPTIONS = [
  { value: "diskspace", label: "Disk space" },
  { value: "cpuload",   label: "CPU load" },
  { value: "memory",    label: "Memory" },
  { value: "ping",      label: "Ping" },
  { value: "winsvc",    label: "Windows service" },
  { value: "script",    label: "Script" },
  { value: "eventlog",  label: "Event log" },
];

const SEVERITY_OPTIONS = [
  { value: "info",    label: "Informational" },
  { value: "warning", label: "Warning" },
  { value: "error",   label: "Error" },
];
const FAIL_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const LOG_NAME_OPTIONS = ["Application", "System", "Security"];
const EVT_TYPE_OPTIONS = [
  { value: "INFO",          label: "Information" },
  { value: "WARNING",       label: "Warning" },
  { value: "ERROR",         label: "Error" },
  { value: "AUDIT_SUCCESS", label: "Audit Success" },
  { value: "AUDIT_FAILURE", label: "Audit Failure" },
];
const FAIL_WHEN_OPTIONS = [
  { value: "contains",     label: "Log contains" },
  { value: "not_contains", label: "Log does not contain" },
];

// ─── form state ────────────────────────────────────────────────────────
function blankForm(type) {
  return {
    name: "",
    check_type: type || "diskspace",
    alert_severity: "warning",
    fails_b4_alert: 1,
    run_interval: 0,
    dashboard_alert: true,
    email_alert: false,
    text_alert: false,
    // diskspace
    disk: "C:",
    warning_threshold: 0,
    error_threshold: 0,
    // ping
    ip: "",
    // winsvc
    svc_name: "",
    svc_display_name: "",
    pass_if_start_pending: false,
    pass_if_svc_not_exist: false,
    restart_if_stopped: false,
    // script
    script: null,
    script_args: [],
    env_vars: [],
    timeout: 120,
    info_return_codes: [],
    warning_return_codes: [],
    success_return_codes: [],
    // eventlog
    log_name: "Application",
    event_id: 0,
    event_id_is_wildcard: false,
    event_type: "INFO",
    event_source: "",
    event_message: "",
    fail_when: "contains",
    search_last_days: 0,
    number_of_events_b4_alert: 1,
  };
}

const form = ref(blankForm(props.initialCheckType));
const validationError = ref("");
const saving = ref(false);

// raw text mirrors of array fields — easier to edit as strings
const scriptArgsRaw = ref("");
const envVarsRaw    = ref("");
const infoCodesRaw  = ref("");
const warnCodesRaw  = ref("");

// script picker state
const openScriptPicker = ref(false);
const scriptDisplayName = ref("");

function onScriptSelected({ script }) {
  form.value.script = script.id;
  scriptDisplayName.value = script.name;
  openScriptPicker.value = false;
}

// agent metadata loaded on demand
const loadingMeta = ref(false);
const diskOptions = ref(
  "A:,B:,C:,D:,E:,F:,G:,H:,I:,J:,K:,L:,M:,N:,O:,P:,Q:,R:,S:,T:,U:,V:,W:,X:,Y:,Z:".split(",")
);
const allServices = ref([]);
const serviceOptions = ref([]);
const serviceSelectModel = ref(null);

function filterServices(needle, update) {
  update(() => {
    const n = (needle || "").toLowerCase();
    serviceOptions.value = !n
      ? allServices.value
      : allServices.value.filter(
          (s) =>
            s.label.toLowerCase().includes(n) ||
            s.value.toLowerCase().includes(n),
        );
  });
}

function onPickService(value) {
  form.value.svc_name = value;
  const match = allServices.value.find((s) => s.value === value);
  form.value.svc_display_name = match ? match.label : value;
}

async function loadAgentMeta() {
  if (!props.agentId) return;
  loadingMeta.value = true;
  try {
    const agent = await fetchAgent(props.agentId);
    if (agent?.disks?.length) {
      diskOptions.value = agent.disks.map((d) => d.device);
    }
    if (agent?.services?.length) {
      const opts = agent.services
        .map((s) => ({ label: s.display_name || s.name, value: s.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
      allServices.value = Object.freeze(opts);
      serviceOptions.value = allServices.value;
    }
  } catch (e) {
    // Non-fatal — the user can still type a custom drive/service name.
    console.warn("[CheckEditor] agent meta fetch failed", e);
  }
  loadingMeta.value = false;
}

// ─── load existing check when in edit mode ─────────────────────────────
async function loadCheck() {
  if (!props.checkId) return;
  try {
    const data = await fetchCheck(props.checkId);
    Object.assign(form.value, data);
    scriptArgsRaw.value = (data.script_args || []).join("\n");
    envVarsRaw.value    = (data.env_vars    || []).join("\n");
    infoCodesRaw.value  = (data.info_return_codes    || []).join(", ");
    warnCodesRaw.value  = (data.warning_return_codes || []).join(", ");
    if (data.script && typeof data.script === "object") {
      scriptDisplayName.value = data.script.name || "";
      form.value.script = data.script.id ?? data.script;
    } else if (data.script_name) {
      scriptDisplayName.value = data.script_name;
    } else if (data.script) {
      // PK only — best effort lookup so the user sees the name.
      try {
        const all = await fetchScripts();
        const match = (all || []).find((s) => s.id === data.script);
        if (match) scriptDisplayName.value = match.name;
      } catch { /* not fatal */ }
    }
    if (data.svc_name) {
      serviceSelectModel.value = data.svc_name;
    }
  } catch (e) {
    notifyError(`Couldn't load check: ${e?.response?.data?.detail || e?.message || "Unknown error"}`);
    emit("update:modelValue", false);
  }
}

watch(
  () => [props.modelValue, props.checkId, props.initialCheckType],
  async ([open, id, type]) => {
    if (!open) return;
    validationError.value = "";
    if (id) {
      // edit mode — fetch fresh
      form.value = blankForm("diskspace");
      await loadCheck();
    } else {
      // create mode — fresh blank form
      form.value = blankForm(type);
      scriptArgsRaw.value = "";
      envVarsRaw.value = "";
      infoCodesRaw.value = "";
      warnCodesRaw.value = "";
      scriptDisplayName.value = "";
      serviceSelectModel.value = null;
    }
    await loadAgentMeta();
  },
  { immediate: true },
);

onMounted(loadAgentMeta);

// ─── validation + save ────────────────────────────────────────────────
function parseLines(s) {
  return (s || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}
function parseCSVNumbers(s) {
  return (s || "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

function buildPayload() {
  const t = form.value.check_type;
  const base = {
    name: form.value.name?.trim(),
    check_type: t,
    alert_severity: form.value.alert_severity,
    fails_b4_alert: Number(form.value.fails_b4_alert) || 1,
    run_interval: Number(form.value.run_interval) || 0,
    dashboard_alert: !!form.value.dashboard_alert,
    email_alert: !!form.value.email_alert,
    text_alert: !!form.value.text_alert,
  };

  if (t === "diskspace") {
    base.disk = form.value.disk;
    base.warning_threshold = Number(form.value.warning_threshold) || 0;
    base.error_threshold = Number(form.value.error_threshold) || 0;
  } else if (t === "cpuload" || t === "memory") {
    base.warning_threshold = Number(form.value.warning_threshold) || 0;
    base.error_threshold = Number(form.value.error_threshold) || 0;
  } else if (t === "ping") {
    base.ip = (form.value.ip || "").trim();
  } else if (t === "winsvc") {
    base.svc_name = form.value.svc_name;
    base.svc_display_name = form.value.svc_display_name || form.value.svc_name;
    base.pass_if_start_pending = !!form.value.pass_if_start_pending;
    base.pass_if_svc_not_exist = !!form.value.pass_if_svc_not_exist;
    base.restart_if_stopped = !!form.value.restart_if_stopped;
  } else if (t === "script") {
    base.script = form.value.script;
    base.script_args = parseLines(scriptArgsRaw.value);
    base.env_vars = parseLines(envVarsRaw.value);
    base.timeout = Number(form.value.timeout) || 120;
    base.info_return_codes = parseCSVNumbers(infoCodesRaw.value);
    base.warning_return_codes = parseCSVNumbers(warnCodesRaw.value);
  } else if (t === "eventlog") {
    base.log_name = form.value.log_name;
    base.event_id = form.value.event_id_is_wildcard
      ? 0
      : Number(form.value.event_id) || 0;
    base.event_id_is_wildcard = !!form.value.event_id_is_wildcard;
    base.event_type = form.value.event_type;
    base.event_source = form.value.event_source || "";
    base.event_message = form.value.event_message || "";
    base.fail_when = form.value.fail_when || "contains";
    base.search_last_days = Number(form.value.search_last_days) || 0;
    base.number_of_events_b4_alert =
      Number(form.value.number_of_events_b4_alert) || 1;
  }

  // create-mode only — backend reads either agent or policy on create.
  if (!isEdit.value) {
    if (props.policyId) {
      base.policy = props.policyId;
    } else if (props.agentId) {
      base.agent = props.agentId;
    }
  }

  return base;
}

function clientSideValidate(p) {
  if (!p.name) return "Name is required.";
  if (p.check_type === "diskspace") {
    if (!p.disk) return "Drive is required.";
    if (!p.warning_threshold && !p.error_threshold) {
      return "Set a warning or error threshold (%).";
    }
    if (
      p.warning_threshold && p.error_threshold &&
      p.warning_threshold < p.error_threshold
    ) {
      return "For disk-space, warning threshold must be greater than error threshold.";
    }
  }
  if (p.check_type === "cpuload" || p.check_type === "memory") {
    if (!p.warning_threshold && !p.error_threshold) {
      return "Set a warning or error threshold (%).";
    }
    if (
      p.warning_threshold && p.error_threshold &&
      p.warning_threshold > p.error_threshold
    ) {
      return "Warning threshold must be less than error threshold.";
    }
  }
  if (p.check_type === "ping" && !p.ip) {
    return "Target hostname or IP is required.";
  }
  if (p.check_type === "winsvc" && !p.svc_name) {
    return "Service name is required.";
  }
  if (p.check_type === "script" && !p.script) {
    return "Pick a script to run.";
  }
  if (p.check_type === "eventlog") {
    if (!p.log_name) return "Log name is required.";
    if (!p.event_id_is_wildcard && (p.event_id == null || p.event_id === "")) {
      return "Event ID is required (or use wildcard).";
    }
  }
  return "";
}

async function onSave() {
  validationError.value = "";
  const payload = buildPayload();
  const err = clientSideValidate(payload);
  if (err) {
    validationError.value = err;
    return;
  }

  saving.value = true;
  try {
    const res = isEdit.value
      ? await apiUpdateCheck(props.checkId, payload)
      : await apiSaveCheck(payload);
    notifySuccess(typeof res === "string" ? res : "Saved");
    emit("saved", { id: props.checkId, payload });
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
</script>

<style lang="scss" scoped>
.ce {
  width: min(640px, 95vw);
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
    gap: 12px;
  }
  &__row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    &--toggles {
      gap: 18px;
    }
  }
  &__col {
    flex: 1 1 200px;
    min-width: 180px;
    &--grow { flex: 1 1 100%; }
    &--toggle {
      align-self: center;
    }
  }
  &__hint {
    font-size: 12px;
    color: var(--color-fg-secondary);
    padding-left: 4px;
  }
  &__field-label {
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  &__script-pick {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    background: var(--color-bg-page);
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
