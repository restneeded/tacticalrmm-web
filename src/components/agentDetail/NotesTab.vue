<!--
  NotesTab — pinned + free-form notes attached to one agent.

  Endpoints used (existing, unchanged):
    GET    /agents/<id>/notes/        → list
    POST   /agents/notes/             → create   (body: { agent_id, note })
    PUT    /agents/notes/<pk>/        → update   (body: { note })
    DELETE /agents/notes/<pk>/        → remove

  Note: the Note model upstream does not currently have a `pinned`
  field. The phase brief mentions "pinned notes if the data model
  supports it" — it doesn't (yet), so we surface notes as a flat
  reverse-chronological list. Adding a pinned flag would be a
  separate phase touching the Django migration.
-->
<template>
  <div class="ad-tab">
    <header class="ad-tab__bar">
      <q-btn
        flat
        dense
        no-caps
        icon="add"
        label="Add note"
        @click="startCreate"
      />
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        label="Refresh"
        :loading="loading"
        @click="load"
      />
    </header>

    <div v-if="composing" class="composer">
      <textarea
        v-model="draft"
        placeholder="Write a note…"
        class="composer__input"
        rows="4"
      />
      <div class="composer__actions">
        <q-btn flat dense no-caps label="Cancel" @click="cancelCompose" />
        <q-btn
          unelevated
          dense
          no-caps
          color="primary"
          :label="editingId === null ? 'Save' : 'Update'"
          :disable="!draft.trim() || submitting"
          :loading="submitting"
          @click="submit"
        />
      </div>
    </div>

    <div v-if="loading && notes.length === 0" class="state">Loading notes…</div>
    <div v-else-if="errorMsg && notes.length === 0" class="state state--error">
      Couldn't load notes: {{ errorMsg }}
    </div>
    <div v-else-if="notes.length === 0" class="state">
      No notes yet. Add one above.
    </div>
    <ul v-else class="notes">
      <li v-for="n in sortedNotes" :key="n.pk" class="notes__item">
        <header class="notes__head">
          <span class="notes__user">{{ n.username || "system" }}</span>
          <span class="notes__time">{{ formatDate(n.entry_time) }}</span>
          <q-space />
          <q-btn
            flat
            dense
            size="sm"
            icon="edit"
            :ripple="false"
            @click="startEdit(n)"
          >
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            size="sm"
            icon="delete"
            :ripple="false"
            @click="confirmDelete(n)"
          >
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </header>
        <pre class="notes__body">{{ n.note }}</pre>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import {
  fetchAgentNotes,
  saveAgentNote,
  editAgentNote,
  removeAgentNote,
} from "@/api/agents";

interface AgentNote {
  pk: number;
  agent_id?: string;
  username?: string;
  note: string;
  entry_time: string;
}

const props = defineProps<{ agentId: string }>();

const $q = useQuasar();

const notes = ref<AgentNote[]>([]);
const loading = ref(true);
const errorMsg = ref("");

const composing = ref(false);
const draft = ref("");
const editingId = ref<number | null>(null);
const submitting = ref(false);

const sortedNotes = computed(() =>
  [...notes.value].sort(
    (a, b) =>
      new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime(),
  ),
);

async function load() {
  if (!props.agentId) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = (await fetchAgentNotes(props.agentId)) as AgentNote[] | undefined;
    notes.value = Array.isArray(data) ? data : [];
  } catch (err) {
    errorMsg.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}

function startCreate() {
  composing.value = true;
  draft.value = "";
  editingId.value = null;
}

function startEdit(n: AgentNote) {
  composing.value = true;
  draft.value = n.note ?? "";
  editingId.value = n.pk;
}

function cancelCompose() {
  composing.value = false;
  draft.value = "";
  editingId.value = null;
}

async function submit() {
  if (!draft.value.trim()) return;
  submitting.value = true;
  try {
    if (editingId.value === null) {
      await saveAgentNote({ agent_id: props.agentId, note: draft.value });
    } else {
      await editAgentNote(editingId.value, { note: draft.value });
    }
    cancelCompose();
    await load();
  } catch (err) {
    $q.notify({
      type: "negative",
      message: `Couldn't save note: ${extractMessage(err)}`,
      position: "top",
      timeout: 3000,
    });
  } finally {
    submitting.value = false;
  }
}

function confirmDelete(n: AgentNote) {
  $q.dialog({
    title: "Delete note?",
    message: "This will permanently remove the note.",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await removeAgentNote(n.pk);
      await load();
    } catch (err) {
      $q.notify({
        type: "negative",
        message: `Couldn't delete note: ${extractMessage(err)}`,
        position: "top",
        timeout: 3000,
      });
    }
  });
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  return e?.response?.data?.detail || e?.message || "request failed";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

watch(() => props.agentId, load);
onMounted(load);
</script>

<style lang="scss" scoped>
.ad-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 4px;

  &__bar {
    display: flex;
    align-items: center;
  }
}

.composer {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__input {
    width: 100%;
    background: var(--color-bg-page);
    color: var(--color-fg-primary);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    padding: 10px 12px;
    font: inherit;
    resize: vertical;
    min-height: 84px;
    &:focus { outline: 2px solid var(--color-accent, #2569d6); outline-offset: -1px; }
  }
  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.state {
  color: var(--color-fg-secondary);
  font-size: 13px;
  padding: 24px 4px;
  text-align: center;

  &--error { color: var(--color-state-negative-fg, #a40e26); }
}

.notes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 12px 14px;
  }
  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin-bottom: 6px;
  }
  &__user { font-weight: 600; color: var(--color-fg-primary); }
  &__body {
    margin: 0;
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 13px;
    color: var(--color-fg-primary);
  }
}
</style>
