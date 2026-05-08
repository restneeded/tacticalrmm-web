import axios from "axios";

import type { AlertTemplate } from "@/types/alerts";

export async function saveAlertTemplate(id: number, payload: AlertTemplate) {
  const { data } = await axios.put(`alerts/templates/${id}/`, payload);
  return data;
}

export async function addAlertTemplate(payload: AlertTemplate) {
  const { data } = await axios.post("alerts/templates/", payload);
  return data;
}

// Phase O — list alert templates so the policy editor can offer a picker.
export async function fetchAlertTemplates() {
  const { data } = await axios.get(`alerts/templates/`);
  return data;
}
