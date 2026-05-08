<!--
  ScriptEditor — the focused script-authoring surface used by both the
  drawer (for quick edits) and the full page (/scripts/:id, /scripts/new).

  Backend:
    POST /scripts/         — create
    PUT  /scripts/<pk>/    — update
    DEL  /scripts/<pk>/    — delete
    POST /scripts/<aid>/test/ — test-run on chosen agent

  Built-ins are read-only except for `favorite` and `hidden`. The form
  reflects this: the body editor goes read-only, save updates only those
  flags, and we surface a banner.

  Keyboard shortcuts:
    Cmd/Ctrl-S → save (no close)
    Cmd/Ctrl-R → test run picker
-->
<template>
  <div class="ed">
    <header class="ed__head">
      <div class="ed__title">
        <q-input
          v-model="form.name"
          dense outlined
          placeholder="Script name"
          :readonly="readOnly"
          :error="!form.name"
          :error-message="form.name ? '' : 'Required'"
          class="ed__name-input"
        />
      </div>
      <q-space />
      <q-btn flat dense no-caps icon="play_arrow" :disable="!form.script_body || readOnly"
             label="Test run" color="primary" @click="onTestClick" />
      <q-btn unelevated no-caps icon="save" :disable="!canSave" :loading="saving"
             label="Save" color="primary" @click="save(false)" />
      <q-btn flat dense no-caps :disable="!canSave" :loading="saving"
             label="Save & close" @click="save(true)" />
      <q-btn flat dense no-caps label="Cancel" @click="$emit('close')" />
      <q-btn v-if="canDelete" flat dense round icon="delete" color="negative" @click="onDelete" />
    </header>

    <q-banner v-if="readOnly" inline-actions class="ed__readonly">
      <template #avatar><q-icon name="lock" /></template>
      Built-in / community script — only the favorite and hidden flags can be edited.
    </q-banner>

    <div class="ed__grid">
      <section class="ed__panel">
        <q-input v-model="form.description" dense outlined autogrow placeholder="Description"
                 :readonly="readOnly" />
        <div class="ed__row">
          <q-select v-model="form.shell" dense outlined :options="SHELL_OPTIONS"
                    map-options emit-value label="Shell" :readonly="readOnly" class="ed__row-grow" />
          <q-input v-model="form.category" dense outlined label="Category"
                   :readonly="readOnly" class="ed__row-grow" />
        </div>
        <div class="ed__row">
          <q-input v-model.number="form.default_timeout" dense outlined type="number"
                   label="Timeout (s)" :readonly="readOnly" class="ed__row-grow" />
          <q-toggle v-model="form.run_as_user" left-label label="Run as logged-in user"
                    :disable="readOnly" />
        </div>

        <div>
          <q-input v-model="argsRaw" dense outlined type="textarea"
                   :rows="3"
                   label="Default arguments (one per line)" :readonly="readOnly" />
          <q-input v-model="envRaw" dense outlined type="textarea"
                   :rows="3"
                   label="Environment variables (KEY=value, one per line)"
                   :readonly="readOnly" />
        </div>

        <div class="ed__row">
          <q-toggle v-model="form.favorite" left-label label="Favorite" />
          <q-toggle v-model="form.hidden"   left-label label="Hidden" />
        </div>

        <div v-if="form.supported_platforms?.length" class="ed__supported">
          Supported on: {{ form.supported_platforms.join(", ") }}
        </div>
      </section>

      <section class="ed__editor-wrap" :class="{ 'ed__editor-wrap--ro': readOnly }">
        <div class="ed__editor-bar">
          <span class="ed__editor-label">{{ SHELL_LABELS[form.shell] || form.shell }} body</span>
          <q-space />
          <span class="ed__editor-hint" v-if="dirty">Unsaved</span>
        </div>
        <div ref="editorEl" class="ed__editor" />
      </section>
    </div>

    <!-- agent picker for test run -->
    <q-dialog v-model="testPickerOpen" persistent>
      <q-card style="min-width: 420px;">
        <q-card-section>
          <div class="text-h6">Test run on agent</div>
          <p class="text-caption">Pick an agent. The script will run live; output appears below.</p>
          <q-select
            v-model="testAgentId"
            :options="agentOptions"
            map-options emit-value
            use-input
            input-debounce="200"
            label="Agent"
            dense outlined
            @filter="onAgentFilter"
          >
            <template #no-option><q-item><q-item-section>No agents</q-item-section></q-item></template>
          </q-select>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Run" :disable="!testAgentId" :loading="testing"
                 @click="dispatchTest" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <RunOutputDrawer
      v-model="testDrawerOpen"
      :title="`Test run · ${form.name || 'script'}`"
      :meta="testMeta"
      :stdout="testResult.stdout"
      :stderr="testResult.stderr"
      :exit-code="testResult.retcode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useQuasar } from "quasar";
import * as monaco from "monaco-editor";
import {
  fetchScript, saveScript, editScript, removeScript, testScript,
} from "@/api/scripts";
import { fetchAgents } from "@/api/agents";
import { useThemeStore } from "@/stores/theme";
import { SHELL_LABELS, SHELL_OPTIONS, SHELL_TO_MONACO } from "./columns";
import RunOutputDrawer from "./RunOutputDrawer.vue";

interface AgentOption { value: string; label: string; }

interface Form {
  id: number | null;
  name: string;
  description: string;
  shell: string;
  category: string;
  args: string[];
  env_vars: string[];
  default_timeout: number;
  favorite: boolean;
  hidden: boolean;
  syntax: string;
  filename: string;
  script_body: string;
  script_type: "userdefined" | "builtin";
  run_as_user: boolean;
  supported_platforms: string[];
}

const props = withDefaults(defineProps<{
  scriptId: number | null;
  /** When mounted as a full page we want a slightly taller editor. */
  layout?: "drawer" | "page";
}>(), {
  layout: "drawer",
});

const emit = defineEmits<{
  (e: "saved", id: number): void;
  (e: "deleted", id: number): void;
  (e: "close"): void;
}>();

const $q = useQuasar();
const theme = useThemeStore();

const form = reactive<Form>({
  id: null, name: "", description: "", shell: "powershell",
  category: "", args: [], env_vars: [], default_timeout: 90,
  favorite: false, hidden: false, syntax: "", filename: "",
  script_body: "", script_type: "userdefined",
  run_as_user: false, supported_platforms: [],
});
let original = JSON.stringify(form);

const argsRaw = ref("");
const envRaw  = ref("");
const editorEl = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

const saving  = ref(false);
const testing = ref(false);

// run picker
const testPickerOpen = ref(false);
const testAgentId    = ref<string | null>(null);
const allAgents      = ref<AgentOption[]>([]);
const agentOptions   = ref<AgentOption[]>([]);
const testDrawerOpen = ref(false);
const testResult     = reactive({ stdout: "", stderr: "", retcode: null as number | null, execution_time: "" });
const testMeta = computed(() => [
  { k: "Agent", v: testAgentId.value || "—" },
  { k: "Shell", v: SHELL_LABELS[form.shell] || form.shell },
  { k: "Exit",  v: testResult.retcode === null ? "—" : String(testResult.retcode) },
  { k: "Time",  v: testResult.execution_time || "—" },
]);

const readOnly = computed(() => form.script_type === "builtin");
const dirty    = computed(() => JSON.stringify(form) !== original);
const canSave  = computed(() => !!form.name && !!form.script_body && (form.id === null || dirty.value));
const canDelete = computed(() => form.id !== null && form.script_type !== "builtin");

async function load() {
  if (!props.scriptId) {
    form.id = null;
    form.name = ""; form.description = ""; form.shell = "powershell";
    form.category = ""; form.args = []; form.env_vars = [];
    form.default_timeout = 90; form.favorite = false; form.hidden = false;
    form.syntax = ""; form.filename = ""; form.script_body = "";
    form.script_type = "userdefined"; form.run_as_user = false;
    form.supported_platforms = [];
    syncRaw(); resetMonaco(); markPristine();
    return;
  }
  try {
    const data = await fetchScript(props.scriptId);
    Object.assign(form, {
      id: data.id, name: data.name || "", description: data.description || "",
      shell: data.shell || "powershell", category: data.category || "",
      args: data.args || [], env_vars: data.env_vars || [],
      default_timeout: data.default_timeout ?? 90,
      favorite: !!data.favorite, hidden: !!data.hidden,
      syntax: data.syntax || "", filename: data.filename || "",
      script_body: data.script_body || "",
      script_type: data.script_type || "userdefined",
      run_as_user: !!data.run_as_user,
      supported_platforms: data.supported_platforms || [],
    });
    syncRaw(); resetMonaco(); markPristine();
  } catch (err) {
    notifyError(err, "Couldn't load script");
  }
}

function syncRaw() {
  argsRaw.value = (form.args || []).join("\n");
  envRaw.value  = (form.env_vars || []).join("\n");
}

watch(argsRaw, (v) => { form.args     = v.split("\n").map((s) => s.trim()).filter(Boolean); });
watch(envRaw,  (v) => { form.env_vars = v.split("\n").map((s) => s.trim()).filter(Boolean); });

function markPristine() { original = JSON.stringify(form); }

function resetMonaco() {
  if (!editor) return;
  editor.setValue(form.script_body || "");
  const lang = SHELL_TO_MONACO[form.shell] || "plaintext";
  const model = editor.getModel();
  if (model) monaco.editor.setModelLanguage(model, lang);
  editor.updateOptions({ readOnly: readOnly.value });
}

watch(() => form.shell, () => {
  if (!editor) return;
  const lang = SHELL_TO_MONACO[form.shell] || "plaintext";
  const model = editor.getModel(); if (model) monaco.editor.setModelLanguage(model, lang);
});

watch(() => theme.resolved, applyTheme);
function applyTheme() {
  monaco.editor.setTheme(theme.resolved === "dark" ? "vs-dark" : "vs");
}

function onTestClick() {
  if (!form.script_body) return;
  testPickerOpen.value = true;
  if (allAgents.value.length === 0) void loadAgents();
}

async function loadAgents() {
  try {
    const data = await fetchAgents();
    const list = Array.isArray(data) ? data : [];
    allAgents.value = list.map((a: { agent_id: string; hostname: string; client_name?: string }) => ({
      value: a.agent_id,
      label: `${a.hostname}${a.client_name ? ` · ${a.client_name}` : ""}`,
    }));
    agentOptions.value = allAgents.value;
  } catch (err) {
    notifyError(err, "Couldn't load agents");
  }
}

function onAgentFilter(val: string, update: (cb: () => void) => void) {
  update(() => {
    const q = (val || "").toLowerCase();
    if (!q) { agentOptions.value = allAgents.value; return; }
    agentOptions.value = allAgents.value.filter((a) => a.label.toLowerCase().includes(q));
  });
}

async function dispatchTest() {
  if (!testAgentId.value) return;
  testing.value = true;
  testResult.stdout = ""; testResult.stderr = ""; testResult.retcode = null; testResult.execution_time = "";
  try {
    const r = await testScript(testAgentId.value, {
      shell: form.shell,
      args: form.args,
      env_vars: form.env_vars,
      timeout: form.default_timeout || 90,
      code: form.script_body,
      run_as_user: form.run_as_user,
    });
    // /scripts/<aid>/test/ returns the agent NATS reply directly: {stdout,stderr,retcode,execution_time}
    if (r && typeof r === "object") {
      testResult.stdout = r.stdout || "";
      testResult.stderr = r.stderr || "";
      testResult.retcode = (typeof r.retcode === "number") ? r.retcode : null;
      testResult.execution_time = r.execution_time || "";
    }
    testPickerOpen.value = false;
    testDrawerOpen.value = true;
  } catch (err) {
    notifyError(err, "Test run failed");
  } finally {
    testing.value = false;
  }
}

async function save(closeAfter: boolean) {
  if (!canSave.value) return;
  saving.value = true;
  try {
    if (form.id === null) {
      await saveScript({
        name: form.name, description: form.description, shell: form.shell,
        args: form.args, env_vars: form.env_vars, category: form.category,
        favorite: form.favorite, hidden: form.hidden,
        script_body: form.script_body, default_timeout: form.default_timeout,
        run_as_user: form.run_as_user, syntax: form.syntax,
        supported_platforms: form.supported_platforms,
      });
      $q.notify({ type: "positive", message: `Saved "${form.name}"`, position: "top" });
      // No id returned by upstream; reload list and close.
      emit("saved", -1);
      if (closeAfter) emit("close");
      else emit("close"); // create flow always closes; user can re-open
    } else {
      const payload: Record<string, unknown> = readOnly.value
        ? { id: form.id, favorite: form.favorite, hidden: form.hidden }
        : {
            id: form.id,
            name: form.name, description: form.description, shell: form.shell,
            args: form.args, env_vars: form.env_vars, category: form.category,
            favorite: form.favorite, hidden: form.hidden,
            script_body: form.script_body, default_timeout: form.default_timeout,
            run_as_user: form.run_as_user, syntax: form.syntax,
            supported_platforms: form.supported_platforms,
          };
      await editScript(payload);
      markPristine();
      $q.notify({ type: "positive", message: `Saved "${form.name}"`, position: "top" });
      emit("saved", form.id);
      if (closeAfter) emit("close");
    }
  } catch (err) {
    notifyError(err, "Save failed");
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  if (!form.id) return;
  $q.dialog({
    title: "Delete script?",
    message: `Permanently delete "${form.name}"?`,
    cancel: true, persistent: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(async () => {
    try {
      await removeScript(form.id!);
      $q.notify({ type: "positive", message: "Deleted", position: "top" });
      emit("deleted", form.id!);
    } catch (err) {
      notifyError(err, "Delete failed");
    }
  });
}

function notifyError(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
  const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
  $q.notify({ type: "negative", message: d || e?.message || fallback, position: "top" });
}

// keyboard shortcuts
function onKeyDown(ev: KeyboardEvent) {
  const mod = ev.metaKey || ev.ctrlKey;
  if (!mod) return;
  if (ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    if (canSave.value) void save(false);
  } else if (ev.key.toLowerCase() === "r") {
    ev.preventDefault();
    onTestClick();
  }
}

onMounted(() => {
  if (editorEl.value) {
    editor = monaco.editor.create(editorEl.value, {
      value: form.script_body,
      language: SHELL_TO_MONACO[form.shell] || "plaintext",
      automaticLayout: true,
      theme: theme.resolved === "dark" ? "vs-dark" : "vs",
      minimap: { enabled: false },
      fontSize: 13,
      tabSize: 2,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      readOnly: readOnly.value,
    });
    editor.onDidChangeModelContent(() => {
      if (editor) form.script_body = editor.getValue();
    });
  }
  void load();
  window.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  if (editor) { editor.dispose(); editor = null; }
});

watch(() => props.scriptId, () => void load());
</script>

<style lang="scss" scoped>
.ed {
  display: flex; flex-direction: column; height: 100%;
  gap: 12px; padding: 14px 18px;
  background: var(--color-bg-surface);

  &__head {
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-bottom: 10px;
  }
  &__title { flex: 1 1 auto; min-width: 240px; }
  &__name-input { font-weight: 600; }
  &__readonly { background: var(--color-bg-subtle); }

  &__grid {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 16px;
    flex: 1 1 auto; min-height: 0;
  }
  &__panel {
    display: flex; flex-direction: column; gap: 10px;
    overflow: auto; padding-right: 4px;
  }
  &__row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  &__row-grow { flex: 1 1 0; min-width: 0; }
  &__supported {
    color: var(--color-fg-tertiary); font-size: 11px;
  }

  &__editor-wrap {
    display: flex; flex-direction: column; min-height: 0;
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-bg-page);
    &--ro { opacity: 0.85; }
  }
  &__editor-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px;
    background: var(--color-bg-page);
    border-bottom: 1px solid var(--color-border-subtle);
    font-size: 12px;
  }
  &__editor-label { font-weight: 600; color: var(--color-fg-secondary); }
  &__editor-hint  { font-size: 11px; color: #c64c00; }
  &__editor       { flex: 1 1 auto; min-height: 360px; }
}
</style>
