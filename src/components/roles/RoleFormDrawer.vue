<!--
  Phase S — Role add/edit drawer.
  Permission matrix grouped by domain (agents / clients / scripts / …) so a
  long flat list isn't dropped on the admin. Superuser toggle bypasses every
  other check on the backend (`tacticalrmm.permissions._has_perm`).

  M2M scope-limiting fields (`can_view_clients`, `can_view_sites`) are NOT
  edited here — they need a multiselect over the clients/sites cache and
  weren't in the Phase S brief. Existing assignments are preserved on save.
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right"
    overlay
    bordered
    :width="560"
    :breakpoint="0"
  >
    <div class="rfd">
      <header class="rfd__head">
        <h2 class="rfd__title">{{ role ? `Edit ${role.name}` : "Add role" }}</h2>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <q-form @submit.prevent="submit" class="rfd__form">
        <q-input
          outlined
          dense
          v-model="state.name"
          label="Role name"
          :rules="[(v) => !!v || 'Required']"
        />

        <q-toggle
          v-model="state.is_superuser"
          label="Superuser (bypasses all permission checks)"
          color="warning"
        />

        <q-banner
          v-if="state.is_superuser"
          dense
          rounded
          class="rfd__warn"
        >
          A superuser role grants every permission, present and future. Assign
          sparingly.
        </q-banner>

        <div v-for="group in PERM_GROUPS" :key="group.label" class="rfd__group">
          <div class="rfd__section-head">
            <h3 class="rfd__section-title">{{ group.label }}</h3>
            <q-btn
              flat
              dense
              size="sm"
              :label="allInGroup(group) ? 'Clear all' : 'Select all'"
              :disable="state.is_superuser"
              @click="toggleGroup(group)"
            />
          </div>
          <div class="rfd__perms">
            <q-checkbox
              v-for="p in group.perms"
              :key="p.key"
              :model-value="!!state[p.key]"
              @update:model-value="(v) => (state[p.key] = !!v)"
              :label="p.label"
              :disable="state.is_superuser"
            />
          </div>
        </div>

        <div class="rfd__actions">
          <q-btn flat label="Cancel" @click="$emit('update:modelValue', false)" />
          <q-btn unelevated type="submit" color="primary" label="Save" :loading="loading" />
        </div>
      </q-form>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuasar } from "quasar";

import { useRolesStore, type RoleRow } from "@/stores/roles";
import { notifySuccess } from "@/utils/notify";

interface PermDef { key: string; label: string }
interface PermGroup { label: string; perms: PermDef[] }

// Mirrors the comment-grouped sections in accounts/models.py:Role.
const PERM_GROUPS: PermGroup[] = [
  {
    label: "Agents",
    perms: [
      { key: "can_list_agents", label: "List agents" },
      { key: "can_edit_agent", label: "Edit agent" },
      { key: "can_uninstall_agents", label: "Uninstall agents" },
      { key: "can_update_agents", label: "Update agents" },
      { key: "can_install_agents", label: "Install agents" },
      { key: "can_recover_agents", label: "Recover agents" },
      { key: "can_reboot_agents", label: "Reboot agents" },
      { key: "can_send_cmd", label: "Send command" },
      { key: "can_run_scripts", label: "Run scripts" },
      { key: "can_run_bulk", label: "Run bulk operations" },
      { key: "can_use_mesh", label: "Use mesh remote" },
      { key: "can_view_eventlogs", label: "View event logs" },
      { key: "can_manage_procs", label: "Manage processes" },
      { key: "can_use_registry", label: "Use registry" },
      { key: "can_send_wol", label: "Wake-on-LAN" },
      { key: "can_list_agent_history", label: "List agent history" },
    ],
  },
  {
    label: "Clients & sites",
    perms: [
      { key: "can_list_clients", label: "List clients" },
      { key: "can_manage_clients", label: "Manage clients" },
      { key: "can_list_sites", label: "List sites" },
      { key: "can_manage_sites", label: "Manage sites" },
      { key: "can_list_deployments", label: "List deployments" },
      { key: "can_manage_deployments", label: "Manage deployments" },
    ],
  },
  {
    label: "Checks",
    perms: [
      { key: "can_list_checks", label: "List checks" },
      { key: "can_manage_checks", label: "Manage checks" },
      { key: "can_run_checks", label: "Run checks" },
    ],
  },
  {
    label: "Tasks",
    perms: [
      { key: "can_list_autotasks", label: "List tasks" },
      { key: "can_manage_autotasks", label: "Manage tasks" },
      { key: "can_run_autotasks", label: "Run tasks" },
    ],
  },
  {
    label: "Policies",
    perms: [
      { key: "can_list_automation_policies", label: "List policies" },
      { key: "can_manage_automation_policies", label: "Manage policies" },
    ],
  },
  {
    label: "Scripts",
    perms: [
      { key: "can_list_scripts", label: "List scripts" },
      { key: "can_manage_scripts", label: "Manage scripts" },
      { key: "can_run_server_scripts", label: "Run server-side scripts" },
    ],
  },
  {
    label: "Alerts",
    perms: [
      { key: "can_list_alerts", label: "List alerts" },
      { key: "can_manage_alerts", label: "Manage alerts" },
      { key: "can_list_alerttemplates", label: "List alert templates" },
      { key: "can_manage_alerttemplates", label: "Manage alert templates" },
    ],
  },
  {
    label: "Software & patching",
    perms: [
      { key: "can_list_software", label: "List software" },
      { key: "can_manage_software", label: "Manage software" },
      { key: "can_manage_winupdates", label: "Manage Windows updates" },
      { key: "can_manage_winsvcs", label: "Manage Windows services" },
    ],
  },
  {
    label: "Operations & logs",
    perms: [
      { key: "can_view_auditlogs", label: "View audit logs" },
      { key: "can_list_pendingactions", label: "List pending actions" },
      { key: "can_manage_pendingactions", label: "Manage pending actions" },
      { key: "can_view_debuglogs", label: "View debug logs" },
      { key: "can_view_schedules", label: "View schedules" },
      { key: "can_manage_schedules", label: "Manage schedules" },
    ],
  },
  {
    label: "Core & settings",
    perms: [
      { key: "can_view_core_settings", label: "View core settings" },
      { key: "can_edit_core_settings", label: "Edit core settings" },
      { key: "can_do_server_maint", label: "Server maintenance" },
      { key: "can_code_sign", label: "Code sign" },
      { key: "can_run_urlactions", label: "Run URL actions" },
      { key: "can_view_customfields", label: "View custom fields" },
      { key: "can_manage_customfields", label: "Manage custom fields" },
      { key: "can_view_global_keystore", label: "View global keystore" },
      { key: "can_edit_global_keystore", label: "Edit global keystore" },
      { key: "can_list_notes", label: "List notes" },
      { key: "can_manage_notes", label: "Manage notes" },
      { key: "can_use_webterm", label: "Use web terminal" },
    ],
  },
  {
    label: "Reporting",
    perms: [
      { key: "can_view_reports", label: "View reports" },
      { key: "can_manage_reports", label: "Manage reports" },
    ],
  },
  {
    label: "Administration",
    perms: [
      { key: "can_list_accounts", label: "List user accounts" },
      { key: "can_manage_accounts", label: "Manage user accounts" },
      { key: "can_list_roles", label: "List roles" },
      { key: "can_manage_roles", label: "Manage roles" },
      { key: "can_list_api_keys", label: "List API keys" },
      { key: "can_manage_api_keys", label: "Manage API keys" },
    ],
  },
];

const ALL_PERM_KEYS: string[] = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

const props = defineProps<{
  modelValue: boolean;
  role?: RoleRow | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const $q = useQuasar();
const store = useRolesStore();

// state is a flat bag — name + is_superuser + every can_* boolean.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = ref<Record<string, any>>(blankState());
const loading = ref(false);

function blankState() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = { name: "", is_superuser: false };
  for (const k of ALL_PERM_KEYS) out[k] = false;
  return out;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.role) {
      // copy known scalar fields; leave the M2M can_view_clients/_sites alone
      // by spreading whatever the API returned — server will keep them as-is
      // because we PUT only the fields it expects.
      const next = blankState();
      for (const k of Object.keys(next)) {
        if (k in props.role) next[k] = (props.role as Record<string, unknown>)[k];
      }
      next.id = props.role.id;
      // preserve M2M for round-trip
      if ("can_view_clients" in props.role) next.can_view_clients = (props.role as Record<string, unknown>).can_view_clients;
      if ("can_view_sites" in props.role) next.can_view_sites = (props.role as Record<string, unknown>).can_view_sites;
      state.value = next;
    } else {
      state.value = blankState();
    }
  },
);

function allInGroup(group: PermGroup): boolean {
  return group.perms.every((p) => !!state.value[p.key]);
}

function toggleGroup(group: PermGroup) {
  if (state.value.is_superuser) return;
  const next = !allInGroup(group);
  for (const p of group.perms) state.value[p.key] = next;
}

async function submit() {
  if (!state.value.name?.trim()) return;
  loading.value = true;
  try {
    if (props.role?.id) {
      await store.update(props.role.id, state.value);
      notifySuccess("Role updated");
    } else {
      await store.create(state.value);
      notifySuccess(`Role ${state.value.name} created`);
    }
    emit("saved");
    emit("update:modelValue", false);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[roles] save:", e);
    $q.notify({ type: "negative", message: "Save failed" });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.rfd {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);
  overflow-y: auto;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  &__title {
    margin: 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: -0.2px;
  }
  &__form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }

  &__warn {
    background: var(--color-bg-surface-2);
    color: var(--color-fg-primary);
    border-left: 3px solid var(--color-warning, #d97706);
  }

  &__group {
    border-top: 1px solid var(--color-stroke-divider);
    padding-top: 12px;
  }
  &__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  &__section-title {
    margin: 0;
    font-size: var(--intune-font-size-200);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--color-fg-tertiary);
  }
  &__perms {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 12px;
    row-gap: 4px;
  }

  &__actions {
    margin-top: 24px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--color-stroke-divider);
    position: sticky;
    bottom: 0;
    background: var(--color-bg-surface);
  }
}
</style>
