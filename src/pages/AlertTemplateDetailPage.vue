<!--
  AlertTemplateDetailPage — Phase P /alerts/templates/:id editor.

  All AlertTemplate fields edited on a single scroll page (NOT inner
  tabs — the form is finite enough that splitting into tabs hides
  context). Mirrors PolicyDetailPage chrome (header + sticky save bar
  on dirty).

  Sections:
    1. Header                  — name, description (NB: model has no
       description field, so the input is omitted), is_active toggle.
    2. Channels & recipients   — email_from, email_recipients,
       text_recipients (chip inputs).
    3. Alert behavior          — three sub-sections (Agent / Check / Task)
       with the per-target booleans + severity matrices + periodic alert
       days. Severity matrix is rendered inline; only Check + Task
       AlertTemplate fields support severity arrays — Agent only has
       always-* booleans (no severity dim).
    4. Actions                 — failure script + resolved script +
       URLAction picker + timeouts. Light-touch: surfaces existing
       fields without spec'ing behavior we don't own.
    5. Exclusions              — exclude_workstations, exclude_servers,
       excluded_sites/clients/agents (rendered as chip lists fed by an
       existing Phase O ExclusionList component if available; otherwise
       plain comma input).
    6. Related (assignments)   — readonly summary from
       /alerts/templates/<id>/related/. Click-through to /policies/:id,
       /clients (Phase O legacy), and agents (Phase J).
-->
<template>
  <q-page class="atd">
    <header v-if="template" class="atd__hero">
      <div class="atd__hero-text">
        <q-input
          v-model="template.name"
          dense outlined
          :placeholder="'Template name'"
          class="atd__name-input"
          @update:model-value="markDirty"
        />
        <div class="atd__sub">
          <span v-if="template.default_template" class="chip chip--info">Default template</span>
          <span class="chip" :class="template.is_active ? 'chip--positive' : ''">
            {{ template.is_active ? "Active" : "Inactive" }}
          </span>
          <span class="chip">{{ template.applied_count ?? 0 }} target(s)</span>
        </div>
      </div>
      <div class="atd__hero-meta">
        <q-toggle v-model="template.is_active" label="Active" @update:model-value="markDirty" />
        <q-btn flat dense icon="delete" color="negative" @click="confirmDelete = true">
          <q-tooltip>Delete template</q-tooltip>
        </q-btn>
      </div>
    </header>

    <div v-if="loading" class="atd__state">Loading template…</div>
    <div v-else-if="errorMsg" class="atd__state atd__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>

    <div v-else-if="template" class="atd__body">
      <!-- ── Channels & recipients ────────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Channels &amp; recipients</h2>
        <p class="atd__sec-lede">
          Recipients listed here override the global lists in CoreSettings
          for any alert this template applies to.
        </p>
        <div class="atd__row">
          <q-input
            v-model="template.email_from"
            dense outlined label="From address (override)"
            placeholder="alerts@example.com"
            class="atd__input"
            @update:model-value="markDirty"
          />
        </div>
        <div class="atd__row">
          <ChipsInput
            v-model="template.email_recipients"
            label="Email recipients"
            placeholder="ops@example.com"
            type="email"
            @change="markDirty"
          />
        </div>
        <div class="atd__row">
          <ChipsInput
            v-model="template.text_recipients"
            label="SMS recipients"
            placeholder="+15551234567"
            @change="markDirty"
          />
        </div>
      </section>

      <!-- ── Alert behavior — Agent ───────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Agent (overdue) alerts</h2>
        <p class="atd__sec-lede">
          Fires when an agent stops checking in. Severity is always
          <SeverityChip severity="error" label="Error" /> — there is no
          per-severity matrix here.
        </p>
        <div class="atd__grid3">
          <q-toggle v-model="template.agent_always_alert" label="Show on dashboard"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.agent_always_email" label="Send email"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.agent_always_text"  label="Send SMS"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-toggle v-model="template.agent_email_on_resolved" label="Email on resolved" @update:model-value="markDirty" />
          <q-toggle v-model="template.agent_text_on_resolved"  label="SMS on resolved"   @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-input
            v-model.number="template.agent_periodic_alert_days"
            dense outlined type="number" min="0"
            label="Re-fire every N days (0 = never)"
            class="atd__input atd__input--narrow"
            @update:model-value="markDirty"
          />
          <q-toggle v-model="template.agent_script_actions" label="Run failure / resolved scripts" @update:model-value="markDirty" />
        </div>
      </section>

      <!-- ── Alert behavior — Check ───────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Check alerts</h2>
        <p class="atd__sec-lede">
          Pick which severities fire on each channel. Empty rows fall
          back to the per-Check defaults.
        </p>
        <SeverityMatrix
          :email="template.check_email_alert_severity"
          :sms="template.check_text_alert_severity"
          :dashboard="template.check_dashboard_alert_severity"
          @update:email="(v) => onCheckMatrix('email', v)"
          @update:sms="(v) => onCheckMatrix('sms', v)"
          @update:dashboard="(v) => onCheckMatrix('dashboard', v)"
        />
        <div class="atd__grid3">
          <q-toggle v-model="template.check_always_alert" label="Always show on dashboard"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.check_always_email" label="Always email"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.check_always_text"  label="Always SMS"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-toggle v-model="template.check_email_on_resolved" label="Email on resolved" @update:model-value="markDirty" />
          <q-toggle v-model="template.check_text_on_resolved"  label="SMS on resolved"   @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-input
            v-model.number="template.check_periodic_alert_days"
            dense outlined type="number" min="0"
            label="Re-fire every N days (0 = never)"
            class="atd__input atd__input--narrow"
            @update:model-value="markDirty"
          />
          <q-toggle v-model="template.check_script_actions" label="Run failure / resolved scripts" @update:model-value="markDirty" />
        </div>
      </section>

      <!-- ── Alert behavior — Task ────────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Task alerts</h2>
        <p class="atd__sec-lede">
          Pick which severities fire on each channel for AutomatedTask
          failures.
        </p>
        <SeverityMatrix
          :email="template.task_email_alert_severity"
          :sms="template.task_text_alert_severity"
          :dashboard="template.task_dashboard_alert_severity"
          @update:email="(v) => onTaskMatrix('email', v)"
          @update:sms="(v) => onTaskMatrix('sms', v)"
          @update:dashboard="(v) => onTaskMatrix('dashboard', v)"
        />
        <div class="atd__grid3">
          <q-toggle v-model="template.task_always_alert" label="Always show on dashboard"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.task_always_email" label="Always email"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
          <q-toggle v-model="template.task_always_text"  label="Always SMS"
                    toggle-indeterminate
                    @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-toggle v-model="template.task_email_on_resolved" label="Email on resolved" @update:model-value="markDirty" />
          <q-toggle v-model="template.task_text_on_resolved"  label="SMS on resolved"   @update:model-value="markDirty" />
        </div>
        <div class="atd__grid2">
          <q-input
            v-model.number="template.task_periodic_alert_days"
            dense outlined type="number" min="0"
            label="Re-fire every N days (0 = never)"
            class="atd__input atd__input--narrow"
            @update:model-value="markDirty"
          />
          <q-toggle v-model="template.task_script_actions" label="Run failure / resolved scripts" @update:model-value="markDirty" />
        </div>
      </section>

      <!-- ── Exclusions ───────────────────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Exclusions</h2>
        <p class="atd__sec-lede">
          Skip specific machine roles or named clients/sites/agents that
          inherit this template via Policy/Client/Site assignment.
        </p>
        <div class="atd__grid2">
          <q-toggle v-model="template.exclude_workstations" label="Exclude all workstations" @update:model-value="markDirty" />
          <q-toggle v-model="template.exclude_servers"      label="Exclude all servers"     @update:model-value="markDirty" />
        </div>
        <p class="atd__sec-lede atd__sec-lede--note">
          Per-client / per-site / per-agent exclusions are managed from
          the Phase O Policy detail page or the Agent detail page so the
          M2M reverse relations stay in sync. They are not editable
          here.
        </p>
      </section>

      <!-- ── Related (assignments) ────────────────────────────── -->
      <section class="atd__sec">
        <h2 class="atd__sec-title">Where this template is used</h2>
        <p v-if="!related" class="atd__sec-lede">Loading…</p>
        <div v-else>
          <div class="atd__rel-row">
            <div class="atd__rel-label">Policies</div>
            <div class="atd__rel-list">
              <span v-if="!related.policies?.length" class="atd__sub">—</span>
              <a v-for="p in related.policies" :key="`pol-${p.id}`"
                 :href="`/policies/${p.id}`" class="chip atd__rel-chip">{{ p.name }}</a>
            </div>
          </div>
          <div class="atd__rel-row">
            <div class="atd__rel-label">Clients</div>
            <div class="atd__rel-list">
              <span v-if="!related.clients?.length" class="atd__sub">—</span>
              <a v-for="c in related.clients" :key="`cli-${c.id}`"
                 :href="`/clients`" class="chip atd__rel-chip">{{ c.name }}</a>
            </div>
          </div>
          <div class="atd__rel-row">
            <div class="atd__rel-label">Sites</div>
            <div class="atd__rel-list">
              <span v-if="!related.sites?.length" class="atd__sub">—</span>
              <a v-for="s in related.sites" :key="`site-${s.id}`"
                 :href="`/clients`" class="chip atd__rel-chip">
                <span v-if="s.client">{{ s.client.name }} · </span>{{ s.name }}
              </a>
            </div>
          </div>
        </div>
      </section>

      <q-space class="atd__bottom-pad" />
    </div>

    <!-- ── Sticky save bar ─────────────────────────────────────── -->
    <Transition name="atd-bar">
      <div v-if="dirty" class="atd__savebar">
        <span class="atd__savebar-text">You have unsaved changes</span>
        <q-space />
        <q-btn flat label="Discard" no-caps :disable="saving" @click="discard" />
        <q-btn unelevated color="primary" label="Save changes" no-caps :loading="saving" @click="save" />
      </div>
    </Transition>

    <q-dialog v-model="confirmDelete">
      <q-card>
        <q-card-section><div class="text-h6">Delete this template?</div></q-card-section>
        <q-card-section class="q-pt-none">
          Any policies/clients/sites/agents currently using this template
          will be detached. This cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="negative" label="Delete" @click="onDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { Notify, Dialog } from "quasar";

import {
  getAlertTemplate,
  saveAlertTemplate,
  deleteAlertTemplate,
  fetchAlertTemplateRelated,
} from "@/api/alerts";

import SeverityChip   from "@/components/alerts/SeverityChip.vue";
import SeverityMatrix from "@/components/alerts/SeverityMatrix.vue";
import ChipsInput     from "@/components/alerts/ChipsInput.vue";

const route  = useRoute();
const router = useRouter();

const template = ref(null);
const original = ref(null);
const related = ref(null);
const loading = ref(true);
const saving = ref(false);
const dirty = ref(false);
const errorMsg = ref("");
const confirmDelete = ref(false);

function markDirty() { dirty.value = true; }

const READ_ONLY_KEYS = [
  "applied_count", "agent_settings", "check_settings", "task_settings",
  "core_settings", "default_template", "action_name", "resolved_action_name",
];
function stripReadOnly(t) {
  const out = { ...t };
  for (const k of READ_ONLY_KEYS) delete out[k];
  delete out.id;
  return out;
}


async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const id = parseInt(route.params.id, 10);
    template.value = await getAlertTemplate(id);
    original.value = JSON.parse(JSON.stringify(template.value));
    fetchAlertTemplateRelated(id)
      .then((r) => { related.value = r; })
      .catch(() => { related.value = { policies: [], clients: [], sites: [] }; });
  } catch (err) {
    errorMsg.value = err?.response?.data?.detail || err?.message || "Failed to load template";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function onCheckMatrix(channel, list) {
  if (!template.value) return;
  if (channel === "email")     template.value.check_email_alert_severity = list;
  if (channel === "sms")       template.value.check_text_alert_severity = list;
  if (channel === "dashboard") template.value.check_dashboard_alert_severity = list;
  markDirty();
}
function onTaskMatrix(channel, list) {
  if (!template.value) return;
  if (channel === "email")     template.value.task_email_alert_severity = list;
  if (channel === "sms")       template.value.task_text_alert_severity = list;
  if (channel === "dashboard") template.value.task_dashboard_alert_severity = list;
  markDirty();
}

async function save() {
  if (!template.value) return;
  saving.value = true;
  try {
    const payload = stripReadOnly(template.value);
    await saveAlertTemplate(template.value.id, payload);
    Notify.create({ type: "positive", message: "Template saved", timeout: 1500 });
    original.value = JSON.parse(JSON.stringify(template.value));
    dirty.value = false;
    // refresh related counts
    fetchAlertTemplateRelated(template.value.id).then((r) => { related.value = r; }).catch(() => {});
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Save failed" });
  } finally {
    saving.value = false;
  }
}

function discard() {
  if (!original.value) return;
  template.value = JSON.parse(JSON.stringify(original.value));
  dirty.value = false;
}

async function onDelete() {
  confirmDelete.value = false;
  try {
    await deleteAlertTemplate(template.value.id);
    Notify.create({ type: "positive", message: "Template deleted", timeout: 1500 });
    router.replace({ name: "Alerts", query: { tab: "templates" } });
  } catch (err) {
    Notify.create({ type: "negative", message: err?.response?.data?.detail || "Delete failed" });
  }
}

// Warn on unsaved-changes navigation.
onBeforeRouteLeave((to, from, next) => {
  if (!dirty.value) return next();
  Dialog.create({
    title: "Discard changes?",
    message: "You have unsaved changes. Leave this page anyway?",
    cancel: true,
    persistent: true,
  }).onOk(() => next()).onCancel(() => next(false));
});

function beforeUnload(e) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
</script>

<style lang="scss" scoped>
.atd {
  padding: 28px 32px 96px;
  max-width: 1100px;
  margin: 0 auto;

  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 16px;
  }
  &__hero-text { flex: 1 1 auto; min-width: 0; }
  &__hero-meta { display: flex; align-items: center; gap: 12px; }

  &__name-input { font-size: 22px; max-width: 600px; }
  &__sub {
    margin-top: 8px;
    display: flex; gap: 6px; flex-wrap: wrap;
    color: var(--color-fg-secondary);
    font-size: 12px;
  }

  &__state {
    margin: 32px auto;
    text-align: center;
    color: var(--color-fg-secondary);
    &--error { color: var(--color-state-negative-fg, #b21f1f); }
  }

  &__body { display: flex; flex-direction: column; gap: 28px; }

  &__sec {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: 8px;
    padding: 20px 22px;
  }
  &__sec-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--color-fg-primary);
  }
  &__sec-lede {
    font-size: 12px;
    color: var(--color-fg-secondary);
    margin: 0 0 14px;
    &--note { font-style: italic; margin-top: 12px; }
  }

  &__row { margin-bottom: 12px; }
  &__input { max-width: 480px; }
  &__input--narrow { max-width: 280px; }

  &__grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 24px;
    margin: 8px 0;
  }
  &__grid3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 24px;
    margin: 8px 0;
  }

  &__rel-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px;
    padding: 6px 0;
    align-items: flex-start;
  }
  &__rel-label { font-size: 12px; color: var(--color-fg-secondary); padding-top: 4px; }
  &__rel-list  { display: flex; flex-wrap: wrap; gap: 6px; }
  &__rel-chip  { text-decoration: none; }

  &__sub  { color: var(--color-fg-tertiary); font-size: 12px; }
  &__bottom-pad { height: 40px; }

  &__savebar {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 24px;
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-stroke-divider);
    box-shadow: var(--intune-shadow-8);
  }
  &__savebar-text { font-weight: 500; color: var(--color-fg-primary); }
}

.atd-bar-enter-from, .atd-bar-leave-to { transform: translateY(100%); }
.atd-bar-enter-active, .atd-bar-leave-active { transition: transform 0.2s var(--intune-curve-decelerate-mid); }

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
  border: 1px solid var(--color-stroke-divider);

  &--positive {
    background: var(--color-state-positive-bg, #e6f6ed);
    color: var(--color-state-positive-fg, #117a3a);
    border-color: transparent;
  }
  &--info {
    background: var(--color-state-info-bg, #e7f0fb);
    color: var(--color-state-info-fg, #1c70d8);
    border-color: transparent;
  }
}
</style>
