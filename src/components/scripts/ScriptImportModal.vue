<!--
  ScriptImportModal — client-side JSON file import.

  The backend has no batch import endpoint, so we parse the file in the
  browser and POST each entry to /scripts/. Errors surface per-row.

  Expected JSON: array of objects with at minimum {name, shell, script_body}.
  Optional fields: description, category, args, env_vars, default_timeout,
  run_as_user, supported_platforms, favorite, hidden.
-->
<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    persistent
  >
    <q-card class="im">
      <q-card-section class="im__head">
        <div>
          <div class="text-h6">Import scripts</div>
          <div class="text-caption">
            Upload a JSON file containing an array of script objects.
          </div>
        </div>
        <q-space />
        <q-btn flat dense round icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="im__body">
        <q-file
          v-model="file"
          dense outlined
          accept=".json,application/json"
          label="Choose JSON file"
          @update:model-value="readFile"
        >
          <template #prepend><q-icon name="upload_file" /></template>
        </q-file>

        <div v-if="parsedCount > 0" class="im__summary">
          Parsed <b>{{ parsedCount }}</b> script{{ parsedCount === 1 ? "" : "s" }} from
          <code>{{ file?.name }}</code>.
        </div>
        <div v-if="parseError" class="im__error">{{ parseError }}</div>

        <div v-if="results.length > 0" class="im__results">
          <div class="im__results-head">Results</div>
          <div
            v-for="r in results"
            :key="r.name + ':' + r.idx"
            class="im__result"
            :class="r.ok ? 'im__result--ok' : 'im__result--bad'"
          >
            <q-icon :name="r.ok ? 'check_circle' : 'error'" />
            <span class="im__result-name">{{ r.name }}</span>
            <span class="im__result-detail">{{ r.detail }}</span>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="im__actions">
        <q-btn flat label="Close" v-close-popup />
        <q-btn unelevated color="primary"
               :disable="parsedCount === 0 || importing || done"
               :loading="importing"
               :label="done ? 'Imported' : `Import ${parsedCount}`"
               @click="runImport" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useQuasar } from "quasar";
import { saveScript } from "@/api/scripts";

interface PendingScript { idx: number; payload: Record<string, unknown> & { name: string } }
interface ImportResult  { idx: number; name: string; ok: boolean; detail: string }

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "imported", results: ImportResult[]): void;
}>();

void props; // avoid unused-prop linter trip

const $q = useQuasar();

const file       = ref<File | null>(null);
const pending    = ref<PendingScript[]>([]);
const parseError = ref("");
const results    = ref<ImportResult[]>([]);
const importing  = ref(false);
const done       = ref(false);

const parsedCount = computed(() => pending.value.length);

async function readFile(f: File | null) {
  pending.value = []; parseError.value = ""; results.value = []; done.value = false;
  if (!f) return;
  try {
    const text = await f.text();
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    pending.value = arr.map((p, idx) => {
      if (!p || typeof p !== "object") throw new Error(`Entry ${idx + 1} is not an object`);
      if (!p.name) throw new Error(`Entry ${idx + 1} missing "name"`);
      if (!p.shell) throw new Error(`Entry ${idx + 1} missing "shell"`);
      if (typeof p.script_body !== "string") throw new Error(`Entry ${idx + 1} missing "script_body"`);
      return {
        idx,
        payload: {
          name: p.name,
          description: p.description || "",
          shell: p.shell,
          args: Array.isArray(p.args) ? p.args : [],
          env_vars: Array.isArray(p.env_vars) ? p.env_vars : [],
          category: p.category || "",
          favorite: !!p.favorite,
          hidden: !!p.hidden,
          script_body: p.script_body,
          default_timeout: typeof p.default_timeout === "number" ? p.default_timeout : 90,
          run_as_user: !!p.run_as_user,
          syntax: p.syntax || "",
          supported_platforms: Array.isArray(p.supported_platforms) ? p.supported_platforms : [],
        },
      };
    });
  } catch (err) {
    parseError.value = (err as Error).message || "Couldn't parse JSON";
    pending.value = [];
  }
}

async function runImport() {
  if (pending.value.length === 0) return;
  importing.value = true;
  results.value = [];
  for (const p of pending.value) {
    try {
      await saveScript(p.payload);
      results.value.push({ idx: p.idx, name: p.payload.name, ok: true, detail: "Saved" });
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } | string }; message?: string };
      const d = typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.detail;
      results.value.push({ idx: p.idx, name: p.payload.name, ok: false, detail: d || e?.message || "failed" });
    }
  }
  importing.value = false;
  done.value = true;
  const okCount = results.value.filter((r) => r.ok).length;
  $q.notify({
    type: okCount === results.value.length ? "positive" : "warning",
    message: `Imported ${okCount} of ${results.value.length} scripts`,
    position: "top",
  });
  emit("imported", results.value.slice());
}
</script>

<style lang="scss" scoped>
.im {
  width: min(560px, 96vw);

  &__head { display: flex; align-items: center; gap: 8px; }
  &__body { display: flex; flex-direction: column; gap: 10px; }

  &__summary { font-size: 13px; color: var(--color-fg-secondary); code { font-size: 12px; } }
  &__error   { color: var(--color-state-negative-fg, #a40e26); font-size: 13px; }

  &__results {
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    background: var(--color-bg-page);
    max-height: 240px; overflow: auto;
  }
  &__results-head {
    padding: 6px 10px;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--color-fg-secondary); font-weight: 600;
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
  }
  &__result {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 8px; align-items: center;
    padding: 6px 10px; font-size: 12.5px;
    border-bottom: 1px solid var(--color-border-subtle);
    &:last-child { border-bottom: none; }
    &--ok  { color: #107c10; }
    &--bad { color: #b32128; }
  }
  &__result-name { color: var(--color-fg-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__result-detail { color: var(--color-fg-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  &__actions { padding: 10px 16px; }
}
</style>
