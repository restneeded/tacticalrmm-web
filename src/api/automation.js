import axios from "axios";

const baseUrl = "/automation";

// ─── Patch policy CRUD (Phase O reuses) ───────────────────────────────
export async function sendPatchPolicyReset(payload) {
  const { data } = await axios.post(`${baseUrl}/patchpolicy/reset/`, payload);
  return data;
}

export async function createPatchPolicy(payload) {
  const { data } = await axios.post(`${baseUrl}/patchpolicy/`, payload);
  return data;
}

export async function updatePatchPolicy(pk, payload) {
  const { data } = await axios.put(`${baseUrl}/patchpolicy/${pk}/`, payload);
  return data;
}

// ─── Policies (Phase O — global library + detail) ─────────────────────
//
// Backend (api/tacticalrmm/automation/{urls,views}.py):
//   GET    /automation/policies/                — table list (with counts)
//   POST   /automation/policies/                — create (optional copyId for dup)
//   GET    /automation/policies/<id>/           — single policy detail
//   PUT    /automation/policies/<id>/           — partial update
//   DELETE /automation/policies/<id>/           — delete
//   GET    /automation/policies/<id>/related/   — direct assignments
//   GET    /automation/policies/overview/       — fleet-wide assignments tree
//   GET    /automation/policies/<id>/checks/    — list policy-checks
//   GET    /automation/policies/<id>/tasks/     — list policy-tasks
//
// Assignment of a Policy to a Client / Site / Agent is done via PUT on
// the *target* (clients/sites/agents endpoints) — Policy itself only owns
// EXCLUSIONS (excluded_clients / excluded_sites / excluded_agents M2M).

export async function fetchPolicies() {
  const { data } = await axios.get(`${baseUrl}/policies/`);
  return data;
}

export async function fetchPolicy(id) {
  const { data } = await axios.get(`${baseUrl}/policies/${id}/`);
  return data;
}

export async function createPolicy(payload) {
  const { data } = await axios.post(`${baseUrl}/policies/`, payload);
  return data;
}

export async function updatePolicy(id, payload) {
  const { data } = await axios.put(`${baseUrl}/policies/${id}/`, payload);
  return data;
}

export async function removePolicy(id) {
  const { data } = await axios.delete(`${baseUrl}/policies/${id}/`);
  return data;
}

export async function fetchPolicyRelated(id) {
  const { data } = await axios.get(`${baseUrl}/policies/${id}/related/`);
  return data;
}

export async function fetchPolicyOverview() {
  const { data } = await axios.get(`${baseUrl}/policies/overview/`);
  return data;
}

export async function fetchPolicyChecks(id) {
  const { data } = await axios.get(`${baseUrl}/policies/${id}/checks/`);
  return data;
}

export async function fetchPolicyTasks(id) {
  const { data } = await axios.get(`${baseUrl}/policies/${id}/tasks/`);
  return data;
}
