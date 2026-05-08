<!--
  Phase S — User detail side drawer.
  Read-only summary + admin actions:
    • Edit user      → opens UserFormDrawer (parent handles)
    • Reset password → prompts admin for a new password, calls UserActions
    • Reset MFA      → clears totp_key on target user
    • Active sessions table — list + per-row revoke + revoke-all
    • Delete user    (root user is rejected by backend; we still show)
-->
<template>
  <q-drawer
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    side="right"
    overlay
    bordered
    :width="480"
    :breakpoint="0"
  >
    <div v-if="user" class="udd">
      <header class="udd__head">
        <div>
          <div class="udd__crumb">User</div>
          <h2 class="udd__title">{{ user.username }}</h2>
        </div>
        <q-btn flat dense round icon="close" @click="$emit('update:modelValue', false)" />
      </header>

      <dl class="udd__grid">
        <div><dt>Name</dt>      <dd>{{ fullName || "—" }}</dd></div>
        <div><dt>Email</dt>     <dd>{{ user.email || "—" }}</dd></div>
        <div><dt>Role</dt>      <dd>{{ roleName }}</dd></div>
        <div><dt>Status</dt>    <dd>{{ user.is_active ? "Active" : "Disabled" }}</dd></div>
        <div><dt>MFA</dt>       <dd>{{ user.totp_key ? "Enabled" : "Not configured" }}</dd></div>
        <div><dt>Last login</dt><dd>{{ user.last_login || "—" }}</dd></div>
        <div><dt>From</dt>      <dd>{{ user.last_login_ip || "—" }}</dd></div>
        <div><dt>SSO</dt>       <dd>{{ ssoSummary }}</dd></div>
      </dl>

      <section class="udd__section">
        <div class="udd__section-head">
          <h3 class="udd__h3">Active sessions</h3>
          <q-btn
            flat
            dense
            icon="refresh"
            @click="loadSessions"
            :loading="sessionsLoading"
          >
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>
        </div>
        <div v-if="sessions.length === 0" class="udd__empty">
          {{ sessionsLoading ? "Loading…" : "No active sessions." }}
        </div>
        <q-list v-else dense bordered separator class="udd__sessions">
          <q-item v-for="s in sessions" :key="s.digest">
            <q-item-section>
              <q-item-label>{{ s.ip || "—" }}</q-item-label>
              <q-item-label caption>
                Created {{ s.created || "—" }}
                <span v-if="s.expiry"> · expires {{ s.expiry }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                icon="logout"
                color="negative"
                @click="revokeOne(s.digest)"
              >
                <q-tooltip>Revoke session</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
        <q-btn
          v-if="sessions.length > 0"
          flat
          dense
          color="negative"
          icon="logout"
          label="Revoke all sessions"
          class="q-mt-sm"
          @click="revokeAll"
        />
      </section>

      <div class="udd__actions">
        <q-btn color="primary" unelevated icon="edit" label="Edit user" @click="$emit('edit')" />
        <q-btn flat icon="vpn_key" label="Reset password" @click="resetPassword" />
        <q-btn flat icon="lock_reset" label="Reset MFA" @click="resetMfa" :disable="!user.totp_key" />
        <q-space />
        <q-btn flat color="negative" icon="delete" label="Delete" @click="$emit('delete')" />
      </div>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuasar } from "quasar";

import { useRolesStore } from "@/stores/roles";
import { useUsersStore, type UserRow } from "@/stores/users";
import {
  fetchUserSessions,
  deleteUserSession,
  deleteAllUserSessions,
  adminResetUserPassword,
  adminResetUserTotp,
} from "@/api/accounts";
import { notifySuccess } from "@/utils/notify";

interface Session {
  digest: string;
  ip?: string;
  created?: string;
  expiry?: string;
}

const props = defineProps<{
  modelValue: boolean;
  user: UserRow | null;
}>();
defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "edit"): void;
  (e: "delete"): void;
}>();

const $q = useQuasar();
const userStore = useUsersStore();
const roleStore = useRolesStore();

const sessions = ref<Session[]>([]);
const sessionsLoading = ref(false);

const fullName = computed(() => {
  if (!props.user) return "";
  return [props.user.first_name, props.user.last_name].filter(Boolean).join(" ");
});

const roleName = computed(() => {
  if (!props.user || props.user.role == null) return "—";
  return (roleStore.rows.find((r) => r.id === props.user!.role)?.name as string) || "—";
});

const ssoSummary = computed(() => {
  const accs = props.user?.social_accounts ?? [];
  if (!accs.length) return "Local";
  return accs.map((a) => `${a.provider}${a.display ? ` (${a.display})` : ""}`).join(", ");
});

async function loadSessions() {
  if (!props.user) return;
  sessionsLoading.value = true;
  try {
    const data = await fetchUserSessions(props.user.id);
    sessions.value = (data ?? []) as Session[];
  } finally {
    sessionsLoading.value = false;
  }
}

watch(
  () => [props.modelValue, props.user?.id],
  ([open]) => {
    if (open && props.user) void loadSessions();
    else sessions.value = [];
  },
);

async function revokeOne(digest: string) {
  await deleteUserSession(digest);
  notifySuccess("Session revoked");
  void loadSessions();
}

async function revokeAll() {
  if (!props.user) return;
  $q.dialog({
    title: "Revoke all sessions?",
    message: `Sign ${props.user.username} out of every active device?`,
    cancel: true,
    persistent: true,
    ok: { label: "Revoke all", color: "negative" },
  }).onOk(async () => {
    await deleteAllUserSessions(props.user!.id);
    notifySuccess("All sessions revoked");
    void loadSessions();
  });
}

function resetPassword() {
  if (!props.user) return;
  $q.dialog({
    title: `Reset password for ${props.user.username}`,
    message: "New password",
    prompt: { model: "", type: "password", isValid: (v: string) => v.length >= 8 },
    cancel: true,
    persistent: true,
  }).onOk(async (pw: string) => {
    await adminResetUserPassword(props.user!.id, pw);
    notifySuccess("Password reset");
  });
}

function resetMfa() {
  if (!props.user) return;
  $q.dialog({
    title: `Reset MFA for ${props.user.username}?`,
    message: "Their TOTP key will be cleared. They'll set it up again on next sign-in.",
    cancel: true,
    persistent: true,
    ok: { label: "Reset MFA", color: "warning" },
  }).onOk(async () => {
    await adminResetUserTotp(props.user!.id);
    notifySuccess("MFA reset");
    // refresh list so the drawer's MFA column updates
    void userStore.load();
  });
}
</script>

<style lang="scss" scoped>
.udd {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  color: var(--color-fg-primary);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  &__crumb { color: var(--color-fg-secondary); font-size: var(--intune-font-size-200); }
  &__title {
    margin: 4px 0 0 0;
    font-size: var(--intune-font-size-600);
    font-weight: var(--intune-font-weight-semibold);
    letter-spacing: -0.2px;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin: 0 0 20px 0;

    > div {
      display: flex;
      flex-direction: column;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-stroke-divider);
    }
    dt {
      font-size: var(--intune-font-size-100);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--color-fg-tertiary);
      margin-bottom: 2px;
    }
    dd {
      margin: 0;
      font-size: var(--intune-font-size-200);
      color: var(--color-fg-primary);
      word-break: break-word;
    }
  }

  &__section { margin-bottom: 20px; }
  &__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  &__h3 { margin: 0; font-size: var(--intune-font-size-300); font-weight: var(--intune-font-weight-semibold); }
  &__empty { color: var(--color-fg-tertiary); font-size: var(--intune-font-size-200); }
  &__sessions { background: var(--color-bg-surface-2); }

  &__actions {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--color-stroke-divider);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}
</style>
