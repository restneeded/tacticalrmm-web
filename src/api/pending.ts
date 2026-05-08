// Phase R — Pending actions queue API.
// Backend: GET /logs/pendingactions/        (fleet-wide list)
//          GET /logs/pendingactions/<aid>/  (per-agent list)
//          DELETE /logs/pendingactions/<pk>/ (cancel)
//
// PAStatus upstream is just {pending, completed} — there's no failed or
// canceled state, so we don't expose retry from the SPA.

import axios, { type AxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/auth";

function authConfig(extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  const auth = useAuthStore();
  const token = auth.token as string | null;
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  };
}

export interface PendingActionRow {
  id: number;
  agent: number;
  agent_id?: string;
  hostname: string;
  client: string | null;
  site: string | null;
  entry_time: string;
  action_type: string;
  status: "pending" | "completed";
  details: Record<string, unknown> | null;
  due: string;
  description: string | null;
}

export async function fetchPendingActions(): Promise<PendingActionRow[]> {
  const r = await axios.get<PendingActionRow[]>(
    "/logs/pendingactions/",
    authConfig(),
  );
  return r.data;
}

export async function fetchAgentPendingActions(
  agentId: string,
): Promise<PendingActionRow[]> {
  const r = await axios.get<PendingActionRow[]>(
    `/logs/pendingactions/${encodeURIComponent(agentId)}/`,
    authConfig(),
  );
  return r.data;
}

export async function cancelPendingAction(pk: number): Promise<void> {
  // Endpoint reads the agent FK + action_type to decide what to do (e.g.
  // for a scheduled reboot it sends NATS delschedtask first), so this is
  // truly "cancel", not just a row delete.
  await axios.delete(`/logs/pendingactions/${pk}/`, authConfig());
}

// Per-action labels match upstream PAAction.
export const PA_ACTION_LABELS: Record<string, string> = {
  schedreboot:     "Scheduled reboot",
  agentupdate:     "Agent update",
  chocoinstall:    "Chocolatey install",
  runcmd:          "Run command",
  runscript:       "Run script",
  runpatchscan:    "Run patch scan",
  runpatchinstall: "Run patch install",
};

export function formatActionType(t: string): string {
  return PA_ACTION_LABELS[t] ?? t;
}
