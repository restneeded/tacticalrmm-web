<!-- Phase T1 — topbar account menu.
     - Username + role badge (Superuser / User from /accounts/permissions/)
     - Profile (Phase T7): navigates to /users?openSelf=1 — UsersPage reads
       the flag and auto-opens UserDetailDrawer for the signed-in account.
       Drawer-only follows Phase S precedent; we deliberately did not add a
       /users/:id route to keep Phase Z's surface minimal.
     - Theme: light / dark / system, persisted via existing theme store (localStorage key "trmm:theme")
     - Sign out: calls auth.logout() (POST /logout/, knox single-token revoke =
       "current session only"), clears token/username/name regardless of response,
       then router.push('/login') -->
<template>
  <q-btn flat round dense aria-label="Account">
    <q-avatar size="28px" color="primary" text-color="white">
      <span class="text-caption">{{ initial }}</span>
    </q-avatar>
    <q-menu
      anchor="bottom right"
      self="top right"
      :offset="[0, 6]"
      class="topbar-account__menu"
    >
      <q-list dense style="min-width: 240px">
        <q-item>
          <q-item-section>
            <q-item-label>{{ displayName }}</q-item-label>
            <q-item-label caption class="q-mt-xs">
              <q-badge
                :color="isSuperuser ? 'primary' : 'grey-7'"
                outline
                :label="roleLabel"
              />
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator />

        <q-item v-close-popup clickable @click="openProfile">
          <q-item-section avatar>
            <q-icon name="account_circle" size="18px" />
          </q-item-section>
          <q-item-section>Profile</q-item-section>
        </q-item>

        <q-separator />
        <q-item-label header>Theme</q-item-label>
        <q-item
          v-for="opt in themeOptions"
          :key="opt.value"
          v-close-popup
          clickable
          @click="setTheme(opt.value)"
        >
          <q-item-section avatar>
            <q-icon :name="opt.icon" size="18px" />
          </q-item-section>
          <q-item-section>{{ opt.label }}</q-item-section>
          <q-item-section side>
            <q-icon
              v-if="theme.mode === opt.value"
              name="check"
              size="16px"
              color="primary"
            />
          </q-item-section>
        </q-item>

        <q-separator />
        <q-item v-close-popup clickable @click="signOut">
          <q-item-section avatar>
            <q-icon name="logout" size="18px" />
          </q-item-section>
          <q-item-section>Sign out</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { useCurrentUserPermsStore } from "@/stores/permissions";

const router = useRouter();
const auth = useAuthStore();
const theme = useThemeStore();
const perms = useCurrentUserPermsStore();

onMounted(() => {
  void perms.ensure();
});

const displayName = computed(() => String(auth.displayName || "User"));
const initial = computed(() => {
  const s = displayName.value;
  return s.length ? s.charAt(0).toUpperCase() : "U";
});
const isSuperuser = computed(() => !!perms.perms.is_superuser);
const roleLabel = computed(() => (isSuperuser.value ? "Superuser" : "User"));

const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "brightness_auto" },
];

function setTheme(m: ThemeMode) {
  theme.setMode(m);
}

function openProfile() {
  // Phase T7 (option b): navigate to /users with a flag the UsersPage reads
  // post-load to auto-open the UserDetailDrawer for the signed-in user.
  // Match by auth.username (the canonical user identifier).
  void router.push({ path: "/users", query: { openSelf: "1" } });
}

async function signOut() {
  // auth.logout() POSTs /logout/ (knox single-session revoke), then clears
  // token/username/name regardless of response (own try/catch internally).
  await auth.logout();
  void router.push("/login");
}
</script>
