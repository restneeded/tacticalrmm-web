// Phase T3 — Clients & Sites operations.
//
// Thin wrappers over the existing /agents/, /checks/, /core/urlaction/
// endpoints used by the Phase I ClientsSitesPage row context menu and the
// extended BulkActionBar. Endpoints themselves are unchanged from the legacy
// DashboardView tree.
import axios from "axios";

export type CSScope = "client" | "site";
type ApiScopeKind = "Client" | "Site";

function apiKind(scope: CSScope): ApiScopeKind {
  return scope === "client" ? "Client" : "Site";
}

/** POST /agents/maintenance/bulk/  — sets maintenance_mode on every agent
 *  under the given client or site. Returns the API's success message string. */
export async function toggleMaintenance(
  scope: CSScope,
  id: number,
  on: boolean,
): Promise<string> {
  const { data } = await axios.post<string>("/agents/maintenance/bulk/", {
    id,
    type: apiKind(scope),
    action: on,
  });
  return data;
}

/** POST /checks/<target>/<pk>/csbulkrun/  — fan-out NATS runchecks to every
 *  agent under the given client/site. Returns the API's success message. */
export async function runChecksScoped(
  scope: CSScope,
  id: number,
): Promise<string> {
  const { data } = await axios.post<string>(
    `/checks/${scope}/${id}/csbulkrun/`,
  );
  return data;
}

export interface URLAction {
  id: number;
  name: string;
  action_type: "web" | "rest";
  pattern: string;
}

/** GET /core/urlaction/ — only web actions are runnable from a row click. */
export async function listWebURLActions(): Promise<URLAction[]> {
  const { data } = await axios.get<URLAction[]>("/core/urlaction/");
  return data
    .filter((a) => a.action_type === "web")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** PATCH /core/urlaction/run/  — server resolves the action template against
 *  the target object and returns the rendered URL string. */
export async function runURLAction(
  scope: CSScope,
  id: number,
  actionId: number,
): Promise<string> {
  const body: Record<string, number> = { action: actionId };
  body[scope] = id;
  const { data } = await axios.patch<string>("/core/urlaction/run/", body);
  return data;
}
