// Phase R — Audit log API.
// Backend exposes PATCH /logs/audit/ with body { pagination, filters... }
// and returns { audit_logs: [], total: <int> }.

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

export interface AuditLogRow {
  id: number;
  username: string;
  agent: string | null;
  agent_id: string | null;
  entry_time: string;
  action: string;
  object_type: string;
  before_value: unknown;
  after_value: unknown;
  message: string | null;
  debug_info: Record<string, unknown> | null;
  ip_address: string | null;
  site: { id: number; name: string; client?: { id: number; name: string } } | null;
}

export interface AuditPagination {
  sortBy: string;
  descending: boolean;
  page: number;
  rowsPerPage: number;
}

export interface AuditQuery {
  pagination: AuditPagination;
  agentFilter?: string[];     // agent_ids
  clientFilter?: number[];    // client pks
  userFilter?: string[];      // usernames
  actionFilter?: string[];    // AuditActionType values
  objectFilter?: string[];    // AuditObjType values
  timeFilter?: number;        // last N days
}

export interface AuditResponse {
  audit_logs: AuditLogRow[];
  total: number;
}

export async function fetchAuditLogs(q: AuditQuery): Promise<AuditResponse> {
  // Strip empty arrays — backend treats absence as "no filter"; an empty
  // array would otherwise narrow to zero rows.
  const body: Record<string, unknown> = { pagination: q.pagination };
  if (q.agentFilter?.length)  body.agentFilter  = q.agentFilter;
  if (q.clientFilter?.length) body.clientFilter = q.clientFilter;
  if (q.userFilter?.length)   body.userFilter   = q.userFilter;
  if (q.actionFilter?.length) body.actionFilter = q.actionFilter;
  if (q.objectFilter?.length) body.objectFilter = q.objectFilter;
  if (q.timeFilter)           body.timeFilter   = q.timeFilter;

  const r = await axios.patch<AuditResponse>("/logs/audit/", body, authConfig());
  return r.data;
}

// Static enum tables, mirrored from tacticalrmm/constants.py.
// Frontend doesn't need a roundtrip for these — they change rarely and
// missing values just render as their raw key.
export const AUDIT_ACTIONS: Array<{ value: string; label: string }> = [
  { value: "login",            label: "User login" },
  { value: "failed_login",     label: "Failed login" },
  { value: "delete",           label: "Delete" },
  { value: "modify",           label: "Modify" },
  { value: "add",              label: "Add" },
  { value: "view",             label: "View" },
  { value: "check_run",        label: "Check run" },
  { value: "task_run",         label: "Task run" },
  { value: "agent_install",    label: "Agent install" },
  { value: "remote_session",   label: "Remote session" },
  { value: "execute_script",   label: "Execute script" },
  { value: "execute_command",  label: "Execute command" },
  { value: "bulk_action",      label: "Bulk action" },
  { value: "url_action",       label: "URL action" },
];

export const AUDIT_OBJECTS: Array<{ value: string; label: string }> = [
  { value: "user",            label: "User" },
  { value: "script",          label: "Script" },
  { value: "agent",           label: "Agent" },
  { value: "policy",          label: "Policy" },
  { value: "winupdatepolicy", label: "Patch policy" },
  { value: "client",          label: "Client" },
  { value: "site",            label: "Site" },
  { value: "check",           label: "Check" },
  { value: "automatedtask",   label: "Automated task" },
  { value: "coresettings",    label: "Core settings" },
  { value: "bulk",            label: "Bulk" },
  { value: "alerttemplate",   label: "Alert template" },
  { value: "role",            label: "Role" },
  { value: "urlaction",       label: "URL action" },
  { value: "keystore",        label: "Key store" },
  { value: "customfield",     label: "Custom field" },
];
