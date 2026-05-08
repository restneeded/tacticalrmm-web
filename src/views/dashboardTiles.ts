// Phase G — canonical dashboard tile catalog. Extracted from HomeView.vue
// because Vue 3 `<script setup>` blocks cannot host ES module exports —
// SettingsPage needs to import CANONICAL_TILES to render the tile builder
// UI without coupling to the dashboard view.
//
// Adding a new tile here = it appears (last) for every existing user.

import { markRaw } from "vue";

import FleetStatusCard from "@/components/dashboard/FleetStatusCard.vue";
import PendingAlertsCard from "@/components/dashboard/PendingAlertsCard.vue";
import PendingActionsCard from "@/components/dashboard/PendingActionsCard.vue";
import ActivityFeedCard from "@/components/dashboard/ActivityFeedCard.vue";
import ClientsOverviewCard from "@/components/dashboard/ClientsOverviewCard.vue";
import CertExpiryCard from "@/components/dashboard/CertExpiryCard.vue";
import VersionStatusCard from "@/components/dashboard/VersionStatusCard.vue";
import PendingPatchesCard from "@/components/dashboard/PendingPatchesCard.vue";

export interface DashboardTile {
  id: string;
  name: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  /** Width in the 12-col grid: "wide" = 6, "medium" = 4. */
  size: "wide" | "medium";
}

export const CANONICAL_TILES: DashboardTile[] = [
  { id: "fleet",    name: "Fleet status",     icon: "computer",        component: markRaw(FleetStatusCard),    size: "wide" },
  { id: "activity", name: "Recent activity",  icon: "history",         component: markRaw(ActivityFeedCard),   size: "wide" },
  { id: "alerts",   name: "Pending alerts",   icon: "notifications",   component: markRaw(PendingAlertsCard),  size: "medium" },
  { id: "pending",  name: "Pending actions",  icon: "pending_actions", component: markRaw(PendingActionsCard), size: "medium" },
  { id: "clients",  name: "Clients overview", icon: "groups",          component: markRaw(ClientsOverviewCard),size: "medium" },
  { id: "cert",     name: "Cert expiry",      icon: "shield",          component: markRaw(CertExpiryCard),     size: "medium" },
  { id: "version",  name: "Version status",   icon: "info",            component: markRaw(VersionStatusCard),  size: "medium" },
  { id: "patches",  name: "Pending updates",  icon: "system_update",   component: markRaw(PendingPatchesCard), size: "medium" },
];
