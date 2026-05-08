import axios from "axios";
import { openURL } from "quasar";
import { router } from "@/router";

import type {
  URLAction,
  TestRunURLActionRequest,
  TestRunURLActionResponse,
} from "@/types/core/urlactions";

import type { CoreSetting } from "@/types/core/settings";
import type { CustomField } from "@/types/core/customfields";

const baseUrl = "/core";

export async function fetchCoreSettings(params = {}): Promise<CoreSetting> {
  const { data } = await axios.get("/core/settings/", { params: params });
  return data;
}

// Phase T2 — partial PUT of CoreSettings (the API serializer accepts a full
// payload but is happy receiving any subset of mutable fields when paired
// with `partial=True`-style updates upstream; the Django view itself does
// `is_valid(raise_exception=True)` against a `CoreSettingsSerializer` bound
// to an instance, which tolerates partials only if `partial=True`. The
// existing FileBar flow PUTs the full settings object back; we mirror that
// to stay safe across nested validators).
export async function editCoreSettings(payload: Partial<CoreSetting>) {
  const { data } = await axios.put(`${baseUrl}/settings/`, payload);
  return data;
}

export async function sendTestEmail() {
  const { data } = await axios.post(`${baseUrl}/emailtest/`);
  return data;
}

export async function sendTestSMS() {
  const { data } = await axios.post(`${baseUrl}/smstest/`);
  return data;
}

export async function fetchDashboardInfo(params = {}) {
  const { data } = await axios.get(`${baseUrl}/dashinfo/`, { params: params });
  return data;
}

export async function fetchCustomFields(params = {}): Promise<CustomField[]> {
  const { data } = await axios.get(`${baseUrl}/customfields/`, {
    params: params,
  });
  return data ?? [];
}

export async function saveCustomField(payload: Partial<CustomField>) {
  const { data } = await axios.post(`${baseUrl}/customfields/`, payload);
  return data;
}

export async function editCustomField(id: number, payload: Partial<CustomField>) {
  const { data } = await axios.put(`${baseUrl}/customfields/${id}/`, payload);
  return data;
}

export async function removeCustomField(id: number) {
  const { data } = await axios.delete(`${baseUrl}/customfields/${id}/`);
  return data;
}

export async function fetchURLActions(params = {}): Promise<URLAction[]> {
  const { data } = await axios.get(`${baseUrl}/urlaction/`, {
    params: params,
  });
  return data;
}

export async function saveURLAction(action: URLAction) {
  const { data } = await axios.post(`${baseUrl}/urlaction/`, action);
  return data;
}

export async function editURLAction(id: number, action: URLAction) {
  const { data } = await axios.put(`${baseUrl}/urlaction/${id}/`, action);
  return data;
}

export async function removeURLAction(id: number) {
  const { data } = await axios.delete(`${baseUrl}/urlaction/${id}/`);
  return data;
}

interface RunURLActionRequest {
  agent_id?: string;
  client?: number;
  site?: number;
  action: number;
}

export async function runURLAction(payload: RunURLActionRequest) {
  const { data } = await axios.patch(`${baseUrl}/urlaction/run/`, payload);
  openURL(data);
}

export async function runTestURLAction(
  payload: TestRunURLActionRequest,
): Promise<TestRunURLActionResponse> {
  const { data } = await axios.post(`${baseUrl}/urlaction/run/test/`, payload);
  return data;
}

export async function checkWebTermPerms(): Promise<{
  message: string;
  status: number;
}> {
  const ret = await axios.post(`${baseUrl}/webtermperms/`);
  return { message: ret.data, status: ret.status };
}

export function openWebTerminal(): void {
  const url: string = router.resolve("/webterm").href;
  openURL(url, undefined, {
    popup: true,
    scrollbars: false,
    location: false,
    status: false,
    toolbar: false,
    menubar: false,
    width: 1280,
    height: 720,
  });
}

// TODO: Build out type for openai payload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateScript(payload: any) {
  const { data } = await axios.post(`${baseUrl}/openai/generate/`, payload);
  return data;
}
