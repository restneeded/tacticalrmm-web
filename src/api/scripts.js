import axios from "axios";

const baseUrl = "/scripts";
const agentsBase = "/agents";

// ─── script CRUD ───────────────────────────────────────────────────

export async function fetchScripts(params = {}) {
  const { data } = await axios.get(`${baseUrl}/`, { params: params });
  return data;
}

export async function fetchScript(id, params = {}) {
  const { data } = await axios.get(`${baseUrl}/${id}/`, { params });
  return data;
}

export async function saveScript(payload) {
  const { data } = await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function editScript(payload) {
  const { data } = await axios.put(`${baseUrl}/${payload.id}/`, payload);
  return data;
}

export async function removeScript(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

export async function downloadScript(id, params = {}) {
  const { data } = await axios.get(`${baseUrl}/${id}/download/`, { params });
  return data;
}

// ─── test-run from editor ──────────────────────────────────────────

export async function testScript(agent_id, payload) {
  const { data } = await axios.post(`${baseUrl}/${agent_id}/test/`, payload);
  return data;
}

export async function testScriptOnServer(payload) {
  const { data } = await axios.post("core/serverscript/test/", payload);
  return data;
}

// ─── per-agent + bulk dispatch ─────────────────────────────────────

// POST /agents/<agent_id>/runscript/  — single agent run
export async function runScriptOnAgent(agent_id, payload) {
  const { data } = await axios.post(`${agentsBase}/${agent_id}/runscript/`, payload);
  return data;
}

// POST /agents/actions/bulk/ mode=script — fleet/site/client/all dispatch
// (Phase K wired the endpoint; we just compose the request shape.)
export async function bulkRunScript(payload) {
  const { data } = await axios.post(`${agentsBase}/actions/bulk/`, payload);
  return data;
}

// ─── fleet-wide run history ────────────────────────────────────────
// GET /agents/scripthistory/  exists from upstream — ScriptRunHistory view.
// Supports start, end, limit, scriptname query params.
export async function fetchScriptRunHistory(params = {}) {
  const { data } = await axios.get(`${agentsBase}/scripthistory/`, { params });
  return data;
}

// ─── snippets (untouched) ──────────────────────────────────────────

export async function fetchScriptSnippets(params = {}) {
  const { data } = await axios.get(`${baseUrl}/snippets/`, { params });
  return data;
}

export async function saveScriptSnippet(payload) {
  const { data } = await axios.post(`${baseUrl}/snippets/`, payload);
  return data;
}

export async function fetchScriptSnippet(id, params = {}) {
  const { data } = await axios.get(`${baseUrl}/snippets/${id}/`, { params });
  return data;
}

export async function editScriptSnippet(payload) {
  const { data } = await axios.put(`${baseUrl}/snippets/${payload.id}/`, payload);
  return data;
}

export async function removeScriptSnippet(id) {
  const { data } = await axios.delete(`${baseUrl}/snippets/${id}/`);
  return data;
}
