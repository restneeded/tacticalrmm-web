<!--
  RunOutputDrawer — generic side drawer for displaying script run output.
  Shared between Run history, Editor test-run, and per-agent run flows.

  Renders monospace, line-numbered, copyable stdout/stderr.
-->
<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => $emit('update:modelValue', v)" position="right" maximized>
    <div class="rod">
      <header class="rod__head">
        <h3>{{ title }}</h3>
        <q-space />
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <dl v-if="meta && meta.length" class="rod__meta">
        <div v-for="m in meta" :key="m.k">
          <dt>{{ m.k }}</dt>
          <dd>{{ m.v }}</dd>
        </div>
      </dl>

      <div class="rod__actions">
        <slot name="actions" />
        <q-space />
        <q-btn
          v-if="stdout"
          flat dense no-caps
          icon="content_copy"
          label="Copy stdout"
          @click="copy(stdout)"
        />
        <q-btn
          v-if="stderr"
          flat dense no-caps
          icon="content_copy"
          label="Copy stderr"
          @click="copy(stderr)"
        />
      </div>

      <section v-if="stdout" class="rod__section">
        <h4>stdout</h4>
        <pre class="rod__pre">
<span v-for="(ln, i) in stdoutLines" :key="`o${i}`" class="rod__ln"><span class="rod__lnno">{{ i + 1 }}</span>{{ ln }}</span>
        </pre>
      </section>

      <section v-if="stderr" class="rod__section">
        <h4>stderr</h4>
        <pre class="rod__pre rod__pre--err">
<span v-for="(ln, i) in stderrLines" :key="`e${i}`" class="rod__ln"><span class="rod__lnno">{{ i + 1 }}</span>{{ ln }}</span>
        </pre>
      </section>

      <section v-if="!stdout && !stderr" class="rod__empty">
        <q-icon name="hourglass_empty" size="32px" />
        <div>No output yet.</div>
        <div class="rod__hint" v-if="exitCode === undefined || exitCode === null">
          Run may still be in progress.
        </div>
      </section>
    </div>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuasar, copyToClipboard } from "quasar";

interface Meta { k: string; v: string }

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  meta?: Meta[];
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
}>(), {
  title: "Run output",
  meta: () => [],
  stdout: "",
  stderr: "",
  exitCode: null,
});

defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const $q = useQuasar();

const stdoutLines = computed(() => splitLines(props.stdout));
const stderrLines = computed(() => splitLines(props.stderr));

function splitLines(s: string): string[] {
  if (!s) return [];
  return s.replace(/\r\n?/g, "\n").split("\n");
}

async function copy(text: string) {
  try {
    await copyToClipboard(text);
    $q.notify({ type: "positive", message: "Copied", position: "top", timeout: 1200 });
  } catch {
    $q.notify({ type: "negative", message: "Couldn't copy", position: "top" });
  }
}
</script>

<style lang="scss" scoped>
.rod {
  width: min(820px, 100vw);
  height: 100%;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);
  display: flex; flex-direction: column;
  padding: 16px 20px; gap: 14px;

  &__head {
    display: flex; align-items: center; gap: 10px;
    h3 { margin: 0; font-size: 16px; font-weight: 600; }
  }
  &__meta {
    margin: 0;
    display: grid; grid-template-columns: 120px 1fr;
    gap: 4px 12px; font-size: 12px;
    div { display: contents; }
    dt { color: var(--color-fg-secondary); margin: 0; }
    dd { margin: 0; }
  }
  &__actions {
    display: flex; align-items: center; gap: 6px;
    border-top: 1px solid var(--color-border-subtle);
    padding-top: 10px;
  }
  &__section {
    h4 {
      margin: 0 0 6px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--color-fg-secondary); font-weight: 600;
    }
  }
  &__pre {
    margin: 0; max-height: 50vh; overflow: auto;
    background: var(--color-bg-page);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    padding: 10px 0;
    font-size: 12.5px; line-height: 1.45;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre;

    &--err { background: rgba(178, 33, 40, 0.06); }
  }
  &__ln {
    display: block; padding: 0 12px;
    &:hover { background: rgba(0,0,0,0.04); }
  }
  &__lnno {
    display: inline-block; min-width: 36px;
    color: var(--color-fg-tertiary);
    text-align: right; padding-right: 12px; user-select: none;
  }
  &__empty {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 32px;
    color: var(--color-fg-secondary); text-align: center;
  }
  &__hint { font-size: 12px; color: var(--color-fg-tertiary); }
}
</style>
