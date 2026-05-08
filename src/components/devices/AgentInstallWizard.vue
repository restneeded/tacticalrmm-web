<!--
  Phase K — AgentInstallWizard.
  4-step modal stepper:
    1. Target   — pick Client + Site (Phase F clientsCache), monitoring type, platform
    2. Options  — agent name pattern, token expiry, RDP/ping/power flags, arch, install method
    3. Generate — server creates installer + auth token, returns artifact URL + cmd
    4. Distribute — three tabs: download, copy command, copy one-liner; QR code for one-liner
  Last-used Client/Site/type are remembered in localStorage so re-opening defaults sensibly.
-->
<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card class="aiw" style="min-width: 720px; max-width: 760px">
      <q-bar class="aiw__bar">
        <q-icon name="install_desktop" />
        <span class="aiw__title">Install Agent</span>
        <q-space />
        <q-btn dense flat icon="close" v-close-popup>
          <q-tooltip>Close</q-tooltip>
        </q-btn>
      </q-bar>

      <q-stepper
        v-model="step"
        ref="stepperRef"
        animated
        flat
        header-nav
        :contracted="$q.screen.lt.md"
        active-color="primary"
      >
        <!-- ── Step 1 — Target ──────────────────────────────────────────── -->
        <q-step :name="1" title="Target" icon="apartment" :done="step > 1">
          <div class="aiw__row">
            <q-select
              outlined
              dense
              options-dense
              label="Client"
              v-model="form.client"
              :options="clientOptions"
              emit-value
              map-options
              :loading="cache.inFlight !== null"
              :rules="[(v) => v != null || 'Required']"
              @update:model-value="form.site = null"
            />
            <q-select
              outlined
              dense
              options-dense
              label="Site"
              v-model="form.site"
              :options="siteOptions"
              emit-value
              map-options
              :disable="form.client == null"
              :rules="[(v) => v != null || 'Required']"
            />
          </div>
          <div class="aiw__cache-meta" v-if="cache.fetchedAt > 0">
            <q-icon name="schedule" size="14px" />
            Cached {{ cache.ageSeconds }}s ago
            <q-btn flat dense size="sm" icon="refresh" @click="cache.refresh()">
              <q-tooltip>Refresh client/site list</q-tooltip>
            </q-btn>
          </div>

          <q-separator class="q-my-md" />

          <p class="aiw__group-label">Monitoring type</p>
          <q-option-group
            v-model="form.agenttype"
            :options="[
              { label: 'Server', value: 'server' },
              { label: 'Workstation', value: 'workstation' },
            ]"
            color="primary"
            inline
            dense
          />

          <p class="aiw__group-label q-mt-md">Platform</p>
          <q-option-group
            v-model="form.plat"
            :options="[
              { label: 'Windows', value: 'windows' },
              { label: 'Linux', value: 'linux' },
              { label: 'macOS', value: 'darwin' },
            ]"
            color="primary"
            inline
            dense
            @update:model-value="onPlatChange"
          />

          <q-stepper-navigation>
            <q-btn unelevated color="primary" label="Next" @click="goNext" />
          </q-stepper-navigation>
        </q-step>

        <!-- ── Step 2 — Options ─────────────────────────────────────────── -->
        <q-step :name="2" title="Options" icon="tune" :done="step > 2">
          <div class="aiw__row">
            <q-input
              v-model.number="form.expires"
              type="number"
              outlined
              dense
              label="Token expires (hours)"
              :rules="[(v) => v >= 1 || 'Minimum 1']"
              style="max-width: 220px"
            />
            <q-select
              outlined
              dense
              options-dense
              label="Architecture"
              v-model="form.goarch"
              :options="archOptions"
              emit-value
              map-options
              style="max-width: 240px"
            />
          </div>

          <q-select
            outlined
            dense
            options-dense
            class="q-mt-md"
            label="Install method"
            v-model="form.installMethod"
            :options="installMethodOptions"
            emit-value
            map-options
            style="max-width: 320px"
          />

          <div class="aiw__flags q-mt-md" v-if="form.plat === 'windows'">
            <q-checkbox v-model="form.rdp" dense label="Enable RDP" />
            <q-checkbox v-model="form.ping" dense label="Enable Ping (ICMP)" />
            <q-checkbox
              v-model="form.power"
              dense
              v-if="form.agenttype === 'workstation'"
              label="Disable sleep/hibernate"
            />
          </div>

          <q-stepper-navigation>
            <q-btn flat label="Back" @click="step = 1" />
            <q-btn unelevated color="primary" label="Generate" @click="generate" :loading="busy" />
          </q-stepper-navigation>
        </q-step>

        <!-- ── Step 3 — Generate ───────────────────────────────────────── -->
        <q-step :name="3" title="Generate" icon="build" :done="step > 3">
          <div v-if="busy" class="aiw__spin">
            <q-spinner-dots size="40px" color="primary" />
            <p>Generating installer & auth token…</p>
          </div>
          <div v-else-if="lastError" class="aiw__error">
            <q-icon name="error" color="negative" size="20px" />
            <span>{{ lastError }}</span>
          </div>
          <div v-else>
            <p>Installer ready. Continue to distribute it.</p>
            <q-stepper-navigation>
              <q-btn flat label="Back" @click="step = 2" />
              <q-btn unelevated color="primary" label="Continue" @click="step = 4" />
            </q-stepper-navigation>
          </div>
        </q-step>

        <!-- ── Step 4 — Distribute ─────────────────────────────────────── -->
        <q-step :name="4" title="Distribute" icon="send" :done="false">
          <q-tabs v-model="distTab" dense align="left" indicator-color="primary">
            <q-tab name="download" label="Download" :disable="!hasBlob" />
            <q-tab name="command" label="Manual command" :disable="!result?.cmd" />
            <q-tab name="oneliner" label="One-liner / QR" :disable="!result?.cmd" />
          </q-tabs>
          <q-separator />

          <q-tab-panels v-model="distTab" animated keep-alive class="aiw__panels">
            <q-tab-panel name="download">
              <p>The installer file has been downloaded to your browser.</p>
              <q-btn
                v-if="hasBlob"
                color="primary"
                icon="download"
                :label="`Re-download ${cachedFileName}`"
                @click="redownload"
              />
            </q-tab-panel>

            <q-tab-panel name="command">
              <p>Run from an elevated terminal on the target device:</p>
              <q-field outlined>
                <pre class="aiw__cmd">{{ result?.cmd }}</pre>
              </q-field>
              <q-btn
                flat
                dense
                color="primary"
                icon="content_copy"
                label="Copy command"
                class="q-mt-sm"
                @click="copy(result?.cmd ?? '')"
              />
              <q-btn
                v-if="result?.url"
                flat
                dense
                color="primary"
                icon="link"
                label="Copy download URL"
                class="q-mt-sm q-ml-sm"
                @click="copy(result?.url ?? '')"
              />
            </q-tab-panel>

            <q-tab-panel name="oneliner">
              <p>Scan from an on-prem tech's phone, or paste into a terminal:</p>
              <div class="aiw__qrwrap">
                <canvas ref="qrCanvas" class="aiw__qr"></canvas>
                <q-btn
                  flat
                  dense
                  color="primary"
                  icon="content_copy"
                  label="Copy one-liner"
                  @click="copy(result?.cmd ?? '')"
                />
              </div>
            </q-tab-panel>
          </q-tab-panels>

          <q-stepper-navigation>
            <q-btn flat label="Back" @click="step = 3" />
            <q-btn unelevated color="primary" label="Done" @click="finish" />
          </q-stepper-navigation>
        </q-step>
      </q-stepper>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useDialogPluginComponent, useQuasar, copyToClipboard } from "quasar";
import QRCode from "qrcode";

import { useClientsCacheStore } from "@/stores/clientsCache";
import {
  generateInstallerBlob,
  generateInstallerJSON,
  type InstallerJSONResponse,
  type InstallerRequest,
} from "@/api/devices";
import { getBaseUrl } from "@/boot/axios";

const { dialogRef, onDialogHide } = useDialogPluginComponent();
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const cache = useClientsCacheStore();

const STORAGE_KEY = "trmm:install-wizard:last";
type Persisted = {
  client?: number;
  site?: number;
  agenttype?: "server" | "workstation";
  plat?: "windows" | "linux" | "darwin";
};

const step = ref(1);
const busy = ref(false);
const lastError = ref("");
const result = ref<InstallerJSONResponse | null>(null);
const cachedBlob = ref<Blob | null>(null);
const cachedFileName = ref("");
const hasBlob = computed(() => cachedBlob.value != null);
const distTab = ref<"download" | "command" | "oneliner">("command");

const ARCH_AMD64 = "amd64";
const ARCH_386 = "386";
const ARCH_ARM64 = "arm64";
const ARCH_ARM = "arm";

const form = reactive({
  client: null as number | null,
  site: null as number | null,
  agenttype: "server" as "server" | "workstation",
  plat: "windows" as "windows" | "linux" | "darwin",
  goarch: ARCH_AMD64,
  installMethod: "exe" as "exe" | "powershell" | "manual" | "bash" | "mac",
  expires: 24,
  rdp: false,
  ping: false,
  power: false,
});

// ── Restore last-used selections ────────────────────────────────────────────
function restorePersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p: Persisted = JSON.parse(raw);
    if (p.client) form.client = p.client;
    if (p.site) form.site = p.site;
    if (p.agenttype) form.agenttype = p.agenttype;
    if (p.plat) {
      form.plat = p.plat;
      onPlatChange(p.plat);
    }
  } catch { /* swallow */ }
}
function persistSelection() {
  const p: Persisted = {
    client: form.client ?? undefined,
    site: form.site ?? undefined,
    agenttype: form.agenttype,
    plat: form.plat,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* swallow */ }
}

// ── Client/site options from clientsCache ───────────────────────────────────
const clientOptions = computed(() =>
  cache.clients.map((c) => ({ label: c.name, value: c.id })),
);
const siteOptions = computed(() =>
  cache.sites
    .filter((s) => s.client === form.client)
    .map((s) => ({ label: s.name, value: s.id })),
);

// ── Arch + install method dependent options ─────────────────────────────────
const archOptions = computed(() => {
  if (form.plat === "windows")
    return [
      { label: "64 bit (amd64)", value: ARCH_AMD64 },
      { label: "32 bit (386)", value: ARCH_386 },
    ];
  if (form.plat === "linux")
    return [
      { label: "64 bit (amd64)", value: ARCH_AMD64 },
      { label: "32 bit (386)", value: ARCH_386 },
      { label: "ARM 64", value: ARCH_ARM64 },
      { label: "ARM 32", value: ARCH_ARM },
    ];
  return [
    { label: "Intel 64 (amd64)", value: ARCH_AMD64 },
    { label: "Apple Silicon (arm64)", value: ARCH_ARM64 },
  ];
});

const installMethodOptions = computed(() => {
  if (form.plat === "windows")
    return [
      { label: "Generate executable (.exe)", value: "exe" },
      { label: "PowerShell script (.ps1)", value: "powershell" },
      { label: "Manual command (no download)", value: "manual" },
    ];
  if (form.plat === "linux") return [{ label: "Bash script (.sh)", value: "bash" }];
  return [{ label: "Manual install command", value: "mac" }];
});

function onPlatChange(plat: "windows" | "linux" | "darwin") {
  if (plat === "windows") {
    form.installMethod = "exe";
    form.goarch = ARCH_AMD64;
  } else if (plat === "linux") {
    form.installMethod = "bash";
    form.goarch = ARCH_AMD64;
  } else {
    form.installMethod = "mac";
    form.goarch = ARCH_AMD64;
  }
}

// ── Step 1 → 2 navigation guard ────────────────────────────────────────────
function goNext() {
  if (form.client == null || form.site == null) {
    $q.notify({ color: "negative", message: "Pick a client and site." });
    return;
  }
  step.value = 2;
}

// ── Step 2 → 3 — call /agents/installer/ ───────────────────────────────────
async function generate() {
  busy.value = true;
  lastError.value = "";
  step.value = 3;
  persistSelection();

  const clientName =
    cache.clients.find((c) => c.id === form.client)?.name ?? "client";
  const siteName =
    cache.sites.find((s) => s.id === form.site)?.name ?? "site";
  const slug = (s: string) =>
    s.replace(/\s/g, "").toLowerCase().replace(/([^a-z0-9]+)/g, "");
  const ext =
    form.plat === "windows"
      ? form.installMethod === "powershell"
        ? "ps1"
        : "exe"
      : form.plat === "linux"
        ? "sh"
        : "pkg";
  const fileName = `trmm-${slug(clientName)}-${slug(siteName)}-${form.agenttype}-${form.goarch}.${ext}`;

  const req: InstallerRequest = {
    installMethod: form.installMethod,
    client: form.client!,
    site: form.site!,
    expires: form.expires,
    agenttype: form.agenttype,
    power: form.power ? 1 : 0,
    rdp: form.rdp ? 1 : 0,
    ping: form.ping ? 1 : 0,
    goarch: form.goarch,
    api: getBaseUrl(),
    fileName,
    plat: form.plat,
  };

  try {
    if (form.installMethod === "manual" || form.installMethod === "mac") {
      result.value = await generateInstallerJSON(req);
      cachedBlob.value = null;
      cachedFileName.value = "";
      distTab.value = "command";
    } else {
      const blob = await generateInstallerBlob(req);
      cachedBlob.value = blob;
      cachedFileName.value = fileName;
      // Trigger immediate download
      triggerBlobDownload(blob, fileName);
      // Build a synthetic one-liner to display alongside the download:
      // "powershell -c (irm <url>) | iex" or curl-pipe-bash
      result.value = synthesiseOneLiner(form.plat, fileName);
      distTab.value = "download";
    }
    await renderQR();
  } catch (err) {
    const detail =
      (err as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail ?? (err as Error).message ?? "Installer generation failed";
    lastError.value = String(detail);
  } finally {
    busy.value = false;
  }
}

function synthesiseOneLiner(
  plat: "windows" | "linux" | "darwin",
  fileName: string,
): InstallerJSONResponse {
  const url = `${getBaseUrl()}/agents/installer/`;
  if (plat === "windows") {
    return {
      cmd: `# Run the downloaded installer:\n.\\${fileName} /VERYSILENT /SUPPRESSMSGBOXES`,
      url,
    };
  }
  if (plat === "linux") {
    return {
      cmd: `chmod +x ${fileName} && sudo ./${fileName}`,
      url,
    };
  }
  return { cmd: `sudo installer -pkg ${fileName} -target /`, url };
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
}

function redownload() {
  if (cachedBlob.value && cachedFileName.value)
    triggerBlobDownload(cachedBlob.value, cachedFileName.value);
}

// ── QR rendering ───────────────────────────────────────────────────────────
const qrCanvas = ref<HTMLCanvasElement | null>(null);
async function renderQR() {
  await nextTick();
  if (!qrCanvas.value || !result.value?.cmd) return;
  await QRCode.toCanvas(qrCanvas.value, result.value.cmd, {
    width: 220,
    margin: 1,
  });
}
watch(distTab, (t) => {
  if (t === "oneliner") void renderQR();
});

async function copy(s: string) {
  if (!s) return;
  try {
    await copyToClipboard(s);
    $q.notify({ color: "positive", message: "Copied to clipboard", icon: "check_circle" });
  } catch {
    $q.notify({ color: "negative", message: "Could not copy" });
  }
}

function finish() {
  onDialogHide();
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await cache.ensureFresh();
  restorePersisted();
});
</script>

<style lang="scss" scoped>
.aiw {
  background: var(--color-bg-card);
  color: var(--color-fg-primary);

  &__bar {
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border-default);
  }
  &__title {
    font-weight: var(--intune-font-weight-semibold);
    margin-left: 6px;
  }
  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  &__cache-meta {
    margin-top: 6px;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  &__group-label {
    margin: 0 0 6px 0;
    font-weight: var(--intune-font-weight-medium);
    color: var(--color-fg-secondary);
  }
  &__flags {
    display: flex;
    gap: 16px;
  }
  &__spin {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 0;
    gap: 12px;
    color: var(--color-fg-secondary);
  }
  &__error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-fg-primary);
    padding: 12px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--intune-radius-medium);
    background: var(--color-bg-subtle);
  }
  &__panels {
    background: transparent;
    padding-top: 12px;
  }
  &__cmd {
    margin: 0;
    padding: 8px;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    color: var(--color-fg-primary);
    background: var(--color-bg-subtle);
    border-radius: var(--intune-radius-small);
    width: 100%;
  }
  &__qrwrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
  }
  &__qr {
    background: white;
    padding: 8px;
    border-radius: var(--intune-radius-small);
  }
}
</style>
