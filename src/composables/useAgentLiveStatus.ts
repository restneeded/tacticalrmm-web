/**
 * useAgentLiveStatus — Phase J Step 0 spike.
 *
 * Returns a reactive view of an agent's live status (online/offline,
 * last_seen, check counts, disks, logged-in user, etc.).
 *
 * IMPORTANT — design tradeoff (Karpathy-flag, surfaced honestly):
 *
 * Upstream tacticalrmm has NO per-agent status websocket. The only
 * websocket channels are:
 *   - ws/dashinfo/        → fleet-level counts (every 30s, broadcast)
 *   - ws/agent/<id>/cmd/  → per-agent command output streaming (one-shot)
 *   - ws/trmmcli/         → server-side terminal
 *
 * The legacy AgentView.vue / SummaryTab.vue do NOT subscribe to a live
 * per-agent feed — they call fetchAgent() once on mount and again when
 * the user clicks "refresh". Building a brand-new per-agent Channels
 * consumer is out of scope for Phase J (would balloon the work and
 * violates the "don't add new endpoints unless absolutely necessary"
 * rule from the phase brief).
 *
 * Therefore "useAgentLiveStatus" is implemented as a polled-live
 * composable: it polls GET /agents/<agent_id>/ on a configurable
 * interval (default 5s) and exposes the result reactively. The shape
 * mirrors the upstream AgentSerializer — no fabricated fields.
 *
 * Fields the upstream agent endpoint does NOT currently expose live:
 *   - real-time CPU load
 *   - real-time memory utilization
 * (These are surfaced via separate Check results, not on the agent
 * record.) The composable returns null for these so consumer code
 * remains stable; the hardware tab can treat null as "not available".
 */

import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  type Ref,
  type ComputedRef,
  isRef,
} from "vue";
import axios from "axios";

// -- types -----------------------------------------------------------------

export interface AgentDisk {
  device: string;
  fstype: string;
  total: string;
  free: string;
  used: string;
  percent: number;
}

export interface AgentChecksSummary {
  total: number;
  passing: number;
  failing: number;
  warning: number;
  info: number;
}

export interface LiveAgentStatus {
  agentId: string;
  hostname: string | null;
  client: string | null;
  siteName: string | null;
  operatingSystem: string | null;
  plat: string | null;
  version: string | null;
  monitoringType: string | null;

  // status
  status: "online" | "offline" | "overdue" | null;
  isOnline: boolean;
  lastSeen: string | null;

  // session
  loggedInUser: string | null;

  // checks
  checks: AgentChecksSummary;
  failingChecks: number;

  // patches / actions
  hasPatchesPending: boolean;
  needsReboot: boolean;
  pendingActionsCount: number;
  maintenanceMode: boolean;

  // disks (from agent.disks JSON)
  disks: AgentDisk[];

  // hardware (from poll)
  totalRamGb: number | null;
  cpuModel: string[] | null;
  publicIp: string | null;
  localIps: string | null;
  makeModel: string | null;

  // intentionally null — not exposed live by upstream
  cpuLoad: null;
  memoryUsage: null;
}

export interface UseAgentLiveStatusOptions {
  /** Polling interval in milliseconds. Default 5000. */
  intervalMs?: number;
  /**
   * Time without a successful poll after which `stale` flips true.
   * Default 30000.
   */
  stalenessThresholdMs?: number;
  /**
   * If true, the composable starts polling on mount automatically.
   * Default true.
   */
  immediate?: boolean;
}

/**
 * Error shape preserved from axios. The project's axios interceptor
 * (src/boot/axios.js) does `Promise.reject({ ...error })`, which spreads
 * an AxiosError into a plain object — so `instanceof Error` will not
 * hold. We keep `unknown` here and let consumers read `.response`,
 * `.message`, etc. defensively.
 */
export type AgentLiveStatusError = unknown;

export interface UseAgentLiveStatusReturn {
  status: Ref<LiveAgentStatus | null>;
  loading: Ref<boolean>;
  error: Ref<AgentLiveStatusError | null>;
  /** True when the last successful poll is older than the staleness threshold. */
  stale: ComputedRef<boolean>;
  /** Last successful poll timestamp (ms since epoch). null if never. */
  lastUpdatedAt: Ref<number | null>;
  /** Force an immediate refresh (returns when the request settles). */
  refresh: () => Promise<void>;
  /** Stop polling. Idempotent. */
  stop: () => void;
  /** Start polling (or restart after stop). Idempotent. */
  start: () => void;
}

// -- impl ------------------------------------------------------------------

function emptyChecks(): AgentChecksSummary {
  return { total: 0, passing: 0, failing: 0, warning: 0, info: 0 };
}

function shapeFromAgentResponse(
  agentId: string,
  raw: Record<string, unknown>,
): LiveAgentStatus {
  const checks = (raw.checks as AgentChecksSummary | undefined) ?? emptyChecks();
  const disksRaw = (raw.disks as Record<string, AgentDisk> | undefined) ?? {};
  const disks: AgentDisk[] = Object.values(disksRaw).filter(
    (d): d is AgentDisk => !!d && typeof d === "object",
  );
  const status = (raw.status as LiveAgentStatus["status"]) ?? null;

  return {
    agentId,
    hostname: (raw.hostname as string) ?? null,
    client: (raw.client as string) ?? null,
    siteName: (raw.site_name as string) ?? null,
    operatingSystem: (raw.operating_system as string) ?? null,
    plat: (raw.plat as string) ?? null,
    version: (raw.version as string) ?? null,
    monitoringType: (raw.monitoring_type as string) ?? null,

    status,
    isOnline: status === "online",
    lastSeen: (raw.last_seen as string) ?? null,

    loggedInUser:
      (raw.logged_in_username as string) ??
      (raw.last_logged_in_user as string) ??
      null,

    checks,
    failingChecks: checks.failing ?? 0,

    hasPatchesPending: !!raw.has_patches_pending,
    needsReboot: !!raw.needs_reboot,
    pendingActionsCount: (raw.pending_actions_count as number) ?? 0,
    maintenanceMode: !!raw.maintenance_mode,

    disks,
    totalRamGb: (raw.total_ram as number) ?? null,
    cpuModel: (raw.cpu_model as string[]) ?? null,
    publicIp: (raw.public_ip as string) ?? null,
    localIps: (raw.local_ips as string) ?? null,
    makeModel: (raw.make_model as string) ?? null,

    cpuLoad: null,
    memoryUsage: null,
  };
}

export function useAgentLiveStatus(
  agentId: Ref<string> | string,
  options: UseAgentLiveStatusOptions = {},
): UseAgentLiveStatusReturn {
  const intervalMs = options.intervalMs ?? 5000;
  const stalenessThresholdMs = options.stalenessThresholdMs ?? 30000;
  const immediate = options.immediate ?? true;

  const idRef: Ref<string> = isRef(agentId) ? agentId : ref(agentId);

  const status = ref<LiveAgentStatus | null>(null);
  const loading = ref(true);
  const error = ref<AgentLiveStatusError | null>(null);
  const lastUpdatedAt = ref<number | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  // monotonic poll counter to ignore late responses after agent_id changes
  let pollSeq = 0;

  // exponential-ish backoff on consecutive failures
  let consecutiveErrors = 0;
  const MAX_BACKOFF_MS = 60_000;

  const stale = computed(() => {
    if (!lastUpdatedAt.value) return false;
    return Date.now() - lastUpdatedAt.value > stalenessThresholdMs;
  });

  function nextDelay(): number {
    if (consecutiveErrors === 0) return intervalMs;
    // 1×, 2×, 4×, 8×, capped at MAX_BACKOFF_MS
    const factor = Math.min(2 ** (consecutiveErrors - 1), 16);
    return Math.min(intervalMs * factor, MAX_BACKOFF_MS);
  }

  async function pollOnce(): Promise<void> {
    const id = idRef.value;
    if (!id) {
      loading.value = false;
      return;
    }
    const seq = ++pollSeq;
    try {
      const { data } = await axios.get(`/agents/${id}/`);
      // ignore stale responses from prior agent_id
      if (seq !== pollSeq) return;
      status.value = shapeFromAgentResponse(id, data);
      error.value = null;
      lastUpdatedAt.value = Date.now();
      consecutiveErrors = 0;
    } catch (err) {
      if (seq !== pollSeq) return;
      consecutiveErrors += 1;
      // Preserve the raw error object — the project's axios interceptor
      // spreads AxiosError into a plain object, so we must not wrap with
      // `new Error(String(err))` (that would yield "[object Object]").
      error.value = err;
      // Stop polling on 4xx (agent doesn't exist or perms denied — retrying
      // serves no purpose and would re-trigger the global Notify interceptor).
      const status =
        (err as { response?: { status?: number } } | null)?.response?.status ??
        0;
      if (status >= 400 && status < 500) {
        stopped = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    } finally {
      if (seq === pollSeq) loading.value = false;
    }
  }

  function scheduleNext() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await pollOnce();
      scheduleNext();
    }, nextDelay());
  }

  async function refresh(): Promise<void> {
    await pollOnce();
  }

  function stop() {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function start() {
    if (!stopped && timer) return; // already running
    stopped = false;
    // immediate poll then schedule
    void (async () => {
      await pollOnce();
      scheduleNext();
    })();
  }

  // Re-poll when agent_id changes; reset state so consumers don't see stale data
  watch(idRef, () => {
    status.value = null;
    error.value = null;
    loading.value = true;
    lastUpdatedAt.value = null;
    consecutiveErrors = 0;
    if (!stopped) {
      if (timer) clearTimeout(timer);
      void (async () => {
        await pollOnce();
        scheduleNext();
      })();
    }
  });

  onMounted(() => {
    if (immediate) start();
  });

  onBeforeUnmount(() => {
    stop();
  });

  return {
    status,
    loading,
    error,
    stale,
    lastUpdatedAt,
    refresh,
    stop,
    start,
  };
}
