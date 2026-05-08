import axios from "axios";

const baseUrl = "/accounts";

// user api functions
export async function fetchUsers(params = {}) {
  try {
    const { data } = await axios.get(`${baseUrl}/users/`, { params: params });
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function resetPass(pass) {
  const payload = { password: pass };
  try {
    const { data } = await axios.put(`${baseUrl}/resetpw/`, payload);
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function resetTwoFactor() {
  try {
    const { data } = await axios.put(`${baseUrl}/reset2fa/`);
    return data;
  } catch (e) {
    console.error(e);
  }
}

// sessions api
export async function fetchUserSessions(id) {
  try {
    const { data } = await axios.get(`${baseUrl}/users/${id}/sessions/`);
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function deleteAllUserSessions(id) {
  try {
    const { data } = await axios.delete(`${baseUrl}/users/${id}/sessions/`);
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function deleteUserSession(id) {
  try {
    const { data } = await axios.delete(`${baseUrl}/sessions/${id}/`);
    return data;
  } catch (e) {
    console.error(e);
  }
}

// role api function
export async function fetchRoles(params = {}) {
  try {
    const { data } = await axios.get(`${baseUrl}/roles/`, { params: params });
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function removeRole(id) {
  const { data } = await axios.delete(`${baseUrl}/roles/${id}/`);
  return data;
}

export async function saveRole(role) {
  const { data } = await axios.post(`${baseUrl}/roles/`, role);
  return data;
}

export async function editRole(id, role) {
  const { data } = await axios.put(`${baseUrl}/roles/${id}/`, role);
  return data;
}

// api key api functions
export async function fetchAPIKeys(params = {}) {
  try {
    const { data } = await axios.get(`${baseUrl}/apikeys/`, { params: params });
    return data;
  } catch (e) {
    console.error(e);
  }
}

export async function saveAPIKey(apiKey) {
  const { data } = await axios.post(`${baseUrl}/apikeys/`, apiKey);
  return data;
}

export async function editAPIKey(id, apiKey) {
  const { data } = await axios.put(`${baseUrl}/apikeys/${id}/`, apiKey);
  return data;
}

export async function removeAPIKey(id) {
  const { data } = await axios.delete(`${baseUrl}/apikeys/${id}/`);
  return data;
}

// ── Phase S additions ────────────────────────────────────────────────────

// user CRUD (admin-side; existing fetchUsers/resetPass/resetTwoFactor stay)
export async function saveUser(payload) {
  const { data } = await axios.post(`${baseUrl}/users/`, payload);
  return data;
}

export async function editUser(id, payload) {
  const { data } = await axios.put(`${baseUrl}/${id}/users/`, payload);
  return data;
}

export async function removeUser(id) {
  const { data } = await axios.delete(`${baseUrl}/${id}/users/`);
  return data;
}

export async function fetchUserDetail(id) {
  const { data } = await axios.get(`${baseUrl}/${id}/users/`);
  return data;
}

// admin-side reset endpoints — UserActions accepts {id, password?}
export async function adminResetUserPassword(id, password) {
  const { data } = await axios.post(`${baseUrl}/users/reset/`, { id, password });
  return data;
}

export async function adminResetUserTotp(id) {
  const { data } = await axios.put(`${baseUrl}/users/reset_totp/`, { id });
  return data;
}

// "what can I do?" — used by the Administration nav group
export async function fetchCurrentUserPerms() {
  const { data } = await axios.get(`${baseUrl}/permissions/`);
  return data;
}
