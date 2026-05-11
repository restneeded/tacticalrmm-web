import { useAuthStore } from "@/stores/auth";

const routes = [
  // ─── AppShell ──────────────────────────────────────────────────────
  // Owns the sidebar + top bar + router-view for the entire app.
  {
    path: "/",
    name: "AppShell",
    component: () => import("@/layouts/AppShell.vue"),
    children: [
      {
        path: "",
        name: "Home",
        alias: "/dashboard",
        component: () => import("@/views/HomeView.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "clients",
        name: "ClientsSites",
        component: () => import("@/pages/ClientsSitesPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase T7: Client detail page — Sites/Agents/Automation/Alerts.
        path: "clients/:id(\\d+)",
        name: "ClientDetail",
        component: () => import("@/pages/ClientDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase T7: Site detail page — Agents/Automation/Alerts.
        path: "sites/:id(\\d+)",
        name: "SiteDetail",
        component: () => import("@/pages/SiteDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "devices",
        name: "Devices",
        component: () => import("@/pages/DevicesPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase J: Agent Detail page (replaces /legacy/agents/:agent_id).
        path: "devices/:agent_id",
        name: "DeviceDetail",
        component: () => import("@/pages/AgentDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase D: lightweight proof-of-life. Phase E adds Discovery + takeover UI.
        path: "software",
        name: "Software",
        component: () => import("@/pages/SoftwareInventoryPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase Q: real fleet-wide Patching surface (replaces Phase A placeholder).
        path: "patching",
        name: "Patching",
        component: () => import("@/pages/PatchingPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase M: checks library + run history.
        path: "checks",
        name: "Checks",
        component: () => import("@/pages/ChecksPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase L: scripts library + editor + run history + scheduled.
        path: "scripts",
        name: "Scripts",
        component: () => import("@/pages/ScriptsPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase N: AutomatedTasks library + run history.
        path: "tasks",
        name: "Tasks",
        component: () => import("@/pages/TasksPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase O: Policies library + assignments overview.
        path: "policies",
        name: "Policies",
        component: () => import("@/pages/PoliciesPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase O: Policy detail page (Checks/Tasks/Assignments/WinUpdate).
        path: "policies/:id(\\d+)",
        name: "PolicyDetail",
        component: () => import("@/pages/PolicyDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase O: Policies library + assignments overview.
        path: "policies",
        name: "Policies",
        component: () => import("@/pages/PoliciesPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase O: Policy detail page (Checks/Tasks/Assignments/WinUpdate).
        path: "policies/:id(\\d+)",
        name: "PolicyDetail",
        component: () => import("@/pages/PolicyDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase P: Alerts dashboard — Active / History / Templates tabs.
        path: "alerts",
        name: "Alerts",
        component: () => import("@/pages/AlertsPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase P: Alert template detail editor.
        path: "alerts/templates/:id(\\d+)",
        name: "AlertTemplateDetail",
        component: () => import("@/pages/AlertTemplateDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "scripts/new",
        name: "ScriptNew",
        component: () => import("@/pages/ScriptDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "scripts/:id(\\d+)",
        name: "ScriptDetail",
        component: () => import("@/pages/ScriptDetailPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase R: read-only audit log surface.
        path: "audit",
        name: "Audit",
        component: () => import("@/pages/AuditPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase R: TRMM pending actions queue with live polling.
        path: "pending",
        name: "PendingActions",
        component: () => import("@/pages/PendingActionsPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase R: system health and debug surfaces.
        path: "diagnostics",
        name: "Diagnostics",
        component: () => import("@/pages/DiagnosticsPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase S: /users — local TRMM accounts CRUD + sessions + MFA admin.
        path: "users",
        name: "Users",
        component: () => import("@/pages/UsersPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase S: /roles — RBAC permission matrix editor.
        path: "roles",
        name: "Roles",
        component: () => import("@/pages/RolesPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase S: /api-keys — bearer keys for scripted integrations.
        path: "api-keys",
        name: "ApiKeys",
        component: () => import("@/pages/ApiKeysPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase G: real reports area (replaces Phase A placeholder).
        path: "reports",
        name: "Reports",
        component: () => import("@/pages/ReportsLandingPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "reports/patch-compliance",
        name: "ReportPatchCompliance",
        component: () => import("@/pages/reports/PatchComplianceReportPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "reports/software-inventory",
        name: "ReportSoftwareInventory",
        component: () => import("@/pages/reports/SoftwareInventoryReportPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "reports/outdated-apps",
        name: "ReportOutdatedApps",
        component: () => import("@/pages/reports/OutdatedAppsReportPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "reports/agent-coverage",
        name: "ReportAgentCoverage",
        component: () => import("@/pages/reports/AgentCoverageReportPage.vue"),
        meta: { requireAuth: true },
      },
      {
        path: "reports/deploy-history",
        name: "ReportDeployHistory",
        component: () => import("@/pages/reports/DeployHistoryReportPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase G: real settings area (replaces Phase A placeholder).
        path: "settings",
        name: "Settings",
        component: () => import("@/pages/SettingsPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase T6: superuser-only honesty page — what's done, what's left, what's deferred.
        path: "migration-status",
        name: "MigrationStatus",
        component: () => import("@/pages/MigrationStatusPage.vue"),
        meta: { requireAuth: true },
      },
      {
        // Phase T5: AppShell-native 404 — last child so any unknown URL renders inside the modern chrome.
        path: ":pathMatch(.*)*",
        name: "NotFound",
        component: () => import("@/views/NotFound.vue"),
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
];

export default routes;
