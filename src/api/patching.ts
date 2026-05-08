/**
 * patching.ts — Phase Q frontend API client.
 *
 * IMPORTANT: leading-slash URLs (resolve against origin, not document.baseURI).
 * See Phase P footgun memory.
 */
import axios from "axios";

export interface FleetStats {
  totals: {
    total_agents: number;
    up_to_date: number;
    pending: number;
    unscanned: number;
    stale_pending: number;
  };
  severity_breakdown: {
    Critical: number;
    Important: number;
    Moderate: number;
    Low: number;
    Optional: number;
  };
  top_pending_kbs: Array<{
    kb: string;
    title: string;
    severity: string;
    agents_affected: number;
  }>;
  scan_failures: Array<{
    agent_id: string;
    hostname: string;
    failed_count: number;
  }>;
}

export interface FleetKBRow {
  kb: string;
  title: string;
  severity: string;
  agents_affected: number;
  agents_pending: number;
  agents_installed: number;
  agents_approved: number;
  agents_ignored: number;
  last_seen: string | null;
}

export interface FleetAgentRow {
  agent_id: string;
  hostname: string;
  client: string | null;
  site: string | null;
  last_seen: string | null;
  patches_last_installed: string | null;
  pending: number;
  pending_critical: number;
  pending_important: number;
  failed: number;
  last_install: string | null;
}

export interface FleetHistoryRow {
  id: number;
  agent_id: string;
  hostname: string;
  kb: string | null;
  title: string | null;
  severity: string;
  date_installed: string | null;
  result: string;
}

export async function fetchFleetStats(): Promise<FleetStats> {
  const { data } = await axios.get("/winupdate/fleet/stats/");
  return data;
}

export async function fetchFleetKBs(params: {
  search?: string;
  severity?: string;
  status?: string;
} = {}): Promise<FleetKBRow[]> {
  const { data } = await axios.get("/winupdate/fleet/kbs/", { params });
  return data;
}

export async function fetchFleetAgents(params: {
  kb?: string;
  client?: string | number;
  site?: string | number;
  pending_min?: number;
  scan_stale_days?: number;
} = {}): Promise<FleetAgentRow[]> {
  const { data } = await axios.get("/winupdate/fleet/agents/", { params });
  return data;
}

export async function fetchFleetHistory(params: {
  kb?: string;
  agent_id?: string;
  since_days?: number;
  result?: string;
} = {}): Promise<FleetHistoryRow[]> {
  const { data } = await axios.get("/winupdate/fleet/history/", { params });
  return data;
}

export async function bulkKBAction(
  kb: string,
  action: "approve" | "ignore" | "nothing",
): Promise<{
  kb: string;
  action: string;
  affected_agents: number;
  affected_updates: number;
}> {
  const { data } = await axios.post(
    `/winupdate/fleet/kb/${encodeURIComponent(kb)}/action/`,
    { action },
  );
  return data;
}

export async function bulkKBInstall(kb: string): Promise<{
  kb: string;
  approved_updates: number;
  dispatched_agents: number;
}> {
  const { data } = await axios.post(
    `/winupdate/fleet/kb/${encodeURIComponent(kb)}/install/`,
  );
  return data;
}
