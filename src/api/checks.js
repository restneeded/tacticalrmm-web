import axios from "axios";

const baseUrl = "/checks";

export async function fetchChecks(params = {}) {
  const { data } = await axios.get(`${baseUrl}/`, { params });
  return data;
}

// Phase M — single check detail (used by editor in edit mode + library drawer).
export async function fetchCheck(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/`);
  return data;
}

export async function saveCheck(payload) {
  const { data } = await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function updateCheck(id, payload) {
  const { data } = await axios.put(`${baseUrl}/${id}/`, payload);
  return data;
}

export async function removeCheck(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

export async function resetCheck(resultId) {
  const { data } = await axios.post(`${baseUrl}/${resultId}/reset/`);
  return data;
}

export async function resetAllChecksStatus(agent_id) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/resetall/`);
  return data;
}

// Phase M — agent-level "Run all checks now" via NATS dispatch.
// TRMM has no per-check run-now endpoint; the agent runs the whole bundle
// when it gets the runchecks NATS verb. Frontend "Run now" buttons on
// individual checks therefore call this and surface a tooltip explaining
// the bundle behaviour.
export async function runAgentChecks(agent_id) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/run/`);
  return data;
}

// Phase M — graph history for a specific CheckResult (per-(check, agent) series).
// timeFilterDays: 0 = all-time, otherwise N days back.
export async function fetchCheckHistory(resultId, timeFilterDays = 30) {
  const { data } = await axios.patch(`${baseUrl}/${resultId}/history/`, {
    timeFilter: timeFilterDays,
  });
  return data;
}

// Phase M — fleet-wide CheckResult feed (for the global Run-history tab).
// All params optional. status ∈ passing|failing|pending. type ∈ CheckType values.
export async function fetchCheckRuns(params = {}) {
  const { data } = await axios.get(`${baseUrl}/runs/`, { params });
  return data;
}
