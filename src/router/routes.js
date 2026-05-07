import { useAuthStore } from "@/stores/auth";

const routes = [
  // ─── New Phase-A shell ──────────────────────────────────────────────
  // The AppShell layout owns the sidebar + top bar + router-view.
  // Each subsequent phase will peel a feature off the legacy DashboardView
  // and land it as a real child route under this shell.
  {
    path: "/",
    name: "AppShell",
    component: () => import("@/layouts/AppShell.vue"),
    children: [
      {
        path: "",
        name: "Home",
        component: () => import("@/views/HomeView.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "devices",
        name: "Devices",
        component: () => import("@/views/phase-b-placeholders/PhaseBPlaceholder.vue"),
        props: {
          title: "Devices",
          icon: "devices",
          lede: "Inventory, health, scripts, and remote-control for every endpoint — re-built around the new shell.",
          phase: "Phase C",
        },
        meta: { requireAuth: true },
      },
      {
        path: "software",
        name: "Software",
        component: () => import("@/views/phase-b-placeholders/PhaseBPlaceholder.vue"),
        props: {
          title: "Software",
          icon: "apps",
          lede: "The killer feature: socket into apps already installed across your fleet, learn their version posture, and keep them aligned automatically.",
          phase: "Phase D & E",
        },
        meta: { requireAuth: true },
      },
      {
        path: "patching",
        name: "Patching",
        component: () => import("@/views/phase-b-placeholders/PhaseBPlaceholder.vue"),
        props: {
          title: "Patching",
          icon: "system_update",
          lede: "Windows updates, third-party patching via Chocolatey + WinGet, ringed rollouts, and drift compliance.",
          phase: "Phase F",
        },
        meta: { requireAuth: true },
      },
      {
        path: "reports",
        name: "Reports",
        component: () => import("@/views/phase-b-placeholders/PhaseBPlaceholder.vue"),
        props: {
          title: "Reports",
          icon: "insights",
          lede: "Fleet posture, software prevalence, patch lag, and exec-ready dashboards.",
          phase: "Phase G",
        },
        meta: { requireAuth: true },
      },
      {
        path: "settings",
        name: "Settings",
        component: () => import("@/views/phase-b-placeholders/PhaseBPlaceholder.vue"),
        props: {
          title: "Settings",
          icon: "settings",
          lede: "Tenant settings, agents, scripts, integrations, SSO, alert policies, and theming.",
          phase: "Phase H",
        },
        meta: { requireAuth: true },
      },
    ],
  },

  // ─── Legacy MainLayout — UNCHANGED, kept fully functional ──────────
  // Every existing tab/feature stays reachable here while we migrate
  // them into the new shell phase by phase.
  {
    path: "/legacy",
    name: "MainLayout",
    component: () => import("@/layouts/MainLayout.vue"),
    children: [
      {
        path: "agents/:agent_id",
        name: "Agent",
        component: () => import("@/views/AgentView.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "",
        name: "Dashboard",
        component: () => import("@/views/DashboardView.vue"),
        meta: { requireAuth: true },
      },
    ],
  },

  // ─── Auth, fullscreen tools, and standalone views ──────────────────
  {
    path: "/setup",
    name: "InitialSetup",
    component: () => import("@/views/InitialSetup.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/totp_setup",
    name: "TOTPSetup",
    component: () => import("@/views/TOTPSetup.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/takecontrol/:agent_id",
    name: "TakeControl",
    component: () => import("@/views/TakeControl.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/webvnc/:agent_id/:port",
    name: "VNC",
    component: () => import("@/views/WebVNC.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/webterm",
    name: "WebTerm",
    component: () => import("@/views/WebTerminal.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/remotebackground/:agent_id",
    name: "RemoteBackground",
    component: () => import("@/views/RemoteBackground.vue"),
    meta: { requireAuth: true },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { requiresVisitor: true },
  },
  {
    path: "/expired",
    name: "SessionExpired",
    component: () => import("@/views/SessionExpired.vue"),
    beforeEnter: (_, from) => {
      const auth = useAuthStore();
      auth.next = from.fullPath;
    },
  },
  { path: "/:catchAll(.*)", component: () => import("@/views/NotFound.vue") },
];

export default routes;
