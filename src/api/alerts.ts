// Phase P — full alerts API surface.
//
// Phase O introduced fetchAlertTemplates() so the policy editor's picker
// could populate. Phase P keeps that export untouched and adds CRUD for
// alerts + alert templates on top of the existing
// /alerts/, /alerts/<pk>/, /alerts/bulk/, /alerts/templates/,
// /alerts/templates/<pk>/, /alerts/templates/<pk>/related/ endpoints.
//
// Note: GET /alerts/ doesn't exist on the backend; the list view is a
// PATCH /alerts/ that takes a filter body. We hide that quirk inside
// fetchAlerts().

import axios from "axios";

import type {
  AlertListFilter,
  AlertRow,
  AlertTemplate,
  AlertTemplateRelated,
} from "@/types/alerts";

// ── alert templates (Phase O + P) ────────────────────────────────────────────

export async function fetchAlertTemplates(): Promise<AlertTemplate[]> {
  const { data } = await axios.get<AlertTemplate[]>("/alerts/templates/");
  return data;
}

export async function getAlertTemplate(id: number): Promise<AlertTemplate> {
  const { data } = await axios.get<AlertTemplate>(`/alerts/templates/${id}/`);
  return data;
}

export async function saveAlertTemplate(
  id: number,
  payload: Partial<AlertTemplate>,
) {
  const { data } = await axios.put(`/alerts/templates/${id}/`, payload);
  return data;
}

export async function addAlertTemplate(payload: Partial<AlertTemplate>) {
  const { data } = await axios.post("/alerts/templates/", payload);
  return data;
}

export async function deleteAlertTemplate(id: number) {
  const { data } = await axios.delete(`/alerts/templates/${id}/`);
  return data;
}

export async function fetchAlertTemplateRelated(
  id: number,
): Promise<AlertTemplateRelated> {
  const { data } = await axios.get<AlertTemplateRelated>(
    `/alerts/templates/${id}/related/`,
  );
  return data;
}

// ── alerts (Phase P) ─────────────────────────────────────────────────────────

// PATCH /alerts/ with no filter keys returns the full role-scoped list.
// PATCH /alerts/ with filter keys returns the filtered list.
// PATCH /alerts/ with {top: N} returns the top-N alerts widget shape.
//
// The endpoint expects a non-empty body; we always send at least the
// resolved/snoozed switches so the response is always an array.
export async function fetchAlerts(
  filter: AlertListFilter = {},
): Promise<AlertRow[]> {
  const body: Record<string, unknown> = {};
  if (filter.timeFilter !== undefined) body.timeFilter = filter.timeFilter;
  if (filter.clientFilter !== undefined) body.clientFilter = filter.clientFilter;
  if (filter.siteFilter !== undefined) body.siteFilter = filter.siteFilter;
  if (filter.severityFilter !== undefined)
    body.severityFilter = filter.severityFilter;
  if (filter.resolvedFilter !== undefined)
    body.resolvedFilter = filter.resolvedFilter;
  if (filter.snoozedFilter !== undefined)
    body.snoozedFilter = filter.snoozedFilter;

  // Empty body would route into the unfiltered branch and return everything.
  if (Object.keys(body).length === 0) {
    body.severityFilter = ["error", "warning", "info"];
  }

  const { data } = await axios.patch<AlertRow[]>("/alerts/", body);
  return data;
}

export async function fetchTopAlerts(
  top = 0,
): Promise<{ alerts_count: number; alerts: AlertRow[] }> {
  const { data } = await axios.patch("/alerts/", { top });
  return data;
}

export async function getAlert(id: number): Promise<AlertRow> {
  const { data } = await axios.get<AlertRow>(`/alerts/${id}/`);
  return data;
}

export async function resolveAlert(id: number) {
  const { data } = await axios.put(`/alerts/${id}/`, { type: "resolve" });
  return data;
}

export async function snoozeAlert(id: number, snooze_days: number) {
  const { data } = await axios.put(`/alerts/${id}/`, {
    type: "snooze",
    snooze_days,
  });
  return data;
}

export async function unsnoozeAlert(id: number) {
  const { data } = await axios.put(`/alerts/${id}/`, { type: "unsnooze" });
  return data;
}

export async function hideAlert(id: number) {
  const { data } = await axios.put(`/alerts/${id}/`, { hidden: true });
  return data;
}

export async function deleteAlert(id: number) {
  const { data } = await axios.delete(`/alerts/${id}/`);
  return data;
}

export async function bulkResolveAlerts(alerts: number[]) {
  const { data } = await axios.post("/alerts/bulk/", {
    bulk_action: "resolve",
    alerts,
  });
  return data;
}

export async function bulkSnoozeAlerts(alerts: number[], snooze_days: number) {
  const { data } = await axios.post("/alerts/bulk/", {
    bulk_action: "snooze",
    alerts,
    snooze_days,
  });
  return data;
}
