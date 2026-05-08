import axios from "axios";

const baseUrl = "/tasks";

export async function fetchTasks(params = {}) {
  // Phase N: throw on error so the editor + library tab can surface the
  // detail string. The legacy callers (ScriptsScheduledTab, etc.) already
  // wrap fetchTasks in try/catch, so this no longer swallows.
  const { data } = await axios.get(`${baseUrl}/`, { params: params });
  return data;
}

// Phase N — single task detail (used by editor in edit mode).
export async function fetchTask(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/`);
  return data;
}

export async function saveTask(payload) {
  const { data } = await axios.post(`${baseUrl}/`, payload);
  return data;
}

export async function updateTask(id, payload) {
  const { data } = await axios.put(`${baseUrl}/${id}/`, payload);
  return data;
}

export async function removeTask(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/`);
  return data;
}

export async function runTask(id, payload) {
  const { data } = await axios.post(`${baseUrl}/${id}/run/`, payload);
  return data;
}

// Phase N — fleet-wide TaskResult feed (for the global Run-history tab).
// All params optional. status ∈ passing|failing|pending. task_id, agent_id, since (ISO).
export async function fetchTaskRuns(params = {}) {
  const { data } = await axios.get(`${baseUrl}/runs/`, { params });
  return data;
}
