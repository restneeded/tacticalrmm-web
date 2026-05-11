<!--
  MigrationStatusPage — Phase T6 /migration-status route under AppShell.

  Internal honesty page tracking what's still legacy-only and what gaps
  remain before the Phase Z cutover. Modeled on the Bronson Alumni admin
  "What's not yet wired up" page — hand-curated content (not live
  introspection), superuser-only, no backend.

  Sections:
    1. Modernization status overview (prose)
    2. Phase coverage table (Q–T, all shipped)
    3. Outstanding before Phase Z (checklist of legacy files to retire)
    4. Optional backend extensions deferred (one-liner items, low value)
    5. Permanently deferred / out of scope
    6. Phase Z prereqs (assertions that should already be true)

  Route: /migration-status (gated to superusers via the sidebar).
-->
<template>
  <q-page class="mig">
    <header class="mig__hero">
      <div>
        <h1 class="mig__title">Migration status</h1>
        <p class="mig__lede">
          The AppShell is the modern UI; the <code>/legacy</code> route still
          hosts the original Vue 2-style screens during the dev cycle. Phase Z
          retired legacy entirely. Below: what's done, what's left, and what's
          permanently deferred. This page is hand-curated — it is the truth
          source, not a live report.
        </p>
      </div>
      <div class="mig__hero-meta">
        <span class="mig__stamp">Last reviewed: {{ lastReviewed }}</span>
      </div>
    </header>

    <!-- ─── 1. Phase coverage ─────────────────────────────────── -->
    <section class="mig__section">
      <h2 class="mig__h2">Phase coverage</h2>
      <p class="mig__sub">
        Every modernization phase that has shipped to the AppShell. All phases
        below are landed on the dev forks; production cutover is Phase Z.
      </p>
      <div class="mig__table-wrap">
        <table class="mig__table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Scope</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in phaseCoverage" :key="row.phase">
              <td><strong>{{ row.phase }}</strong></td>
              <td>{{ row.scope }}</td>
              <td>
                <span class="mig__chip" :data-tone="row.tone">
                  {{ row.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ─── 2. Outstanding before Z ───────────────────────────── -->
    <section class="mig__section">
      <h2 class="mig__h2">Outstanding before Phase Z</h2>
      <p class="mig__sub">
        Concrete files and tasks that Phase Z will remove or finalize. Each
        item below is tracked back to the phase that orphaned it.
      </p>
      <ul class="mig__list">
        <li v-for="item in outstanding" :key="item.label" class="mig__list-item">
          <q-icon name="radio_button_unchecked" size="16px" class="mig__icon-todo" />
          <div>
            <div class="mig__list-label">{{ item.label }}</div>
            <div class="mig__list-meta">{{ item.meta }}</div>
          </div>
        </li>
      </ul>
    </section>

    <!-- ─── 3. Backend extensions deferred ────────────────────── -->
    <section class="mig__section">
      <h2 class="mig__h2">Optional backend extensions deferred</h2>
      <p class="mig__sub">
        Small backend changes that the modern UI could exploit, but where the
        current frontend workaround is acceptable. Revisit only if a real
        user-facing problem appears.
      </p>
      <ul class="mig__list">
        <li v-for="item in deferredBackend" :key="item.label" class="mig__list-item">
          <q-icon name="schedule" size="16px" class="mig__icon-defer" />
          <div>
            <div class="mig__list-label">{{ item.label }}</div>
            <div class="mig__list-meta">{{ item.meta }}</div>
          </div>
        </li>
      </ul>
    </section>

    <!-- ─── 4. Permanently deferred ───────────────────────────── -->
    <section class="mig__section">
      <h2 class="mig__h2">Permanently deferred / out of scope</h2>
      <p class="mig__sub">
        These were considered and explicitly ruled out. They are not coming
        back without a fresh decision.
      </p>
      <ul class="mig__list">
        <li v-for="item in outOfScope" :key="item.label" class="mig__list-item">
          <q-icon name="block" size="16px" class="mig__icon-block" />
          <div>
            <div class="mig__list-label">{{ item.label }}</div>
            <div class="mig__list-meta">{{ item.meta }}</div>
          </div>
        </li>
      </ul>
    </section>

    <!-- ─── 5. Phase Z prereqs ────────────────────────────────── -->
    <section class="mig__section">
      <h2 class="mig__h2">Phase Z prerequisites</h2>
      <p class="mig__sub">
        Assertions Phase Z assumes are true before it runs. All boxes should
        be checked here; an unchecked box is a Phase Z blocker.
      </p>
      <ul class="mig__list">
        <li v-for="item in prereqs" :key="item.label" class="mig__list-item">
          <q-icon name="check_circle" size="16px" class="mig__icon-done" />
          <div>
            <div class="mig__list-label">{{ item.label }}</div>
            <div class="mig__list-meta">{{ item.meta }}</div>
          </div>
        </li>
      </ul>
    </section>
  </q-page>
</template>

<script setup lang="ts">
// All content on this page is hand-curated. No fetches, no live
// introspection — keeping it simple is a feature. Future phases can
// promote items into a CI-driven check if it ever becomes interesting.

const lastReviewed = "2026-05-11";

interface PhaseRow {
  phase: string;
  scope: string;
  status: string;
  tone: "shipped";
}

const phaseCoverage: PhaseRow[] = [
  { phase: "Phase Q", scope: "Patching — fleet-wide patch surface", status: "Shipped", tone: "shipped" },
  { phase: "Phase R", scope: "Audit / Pending / Diagnostics + Operations sidebar group", status: "Shipped", tone: "shipped" },
  { phase: "Phase S", scope: "Users / Roles / API keys + Administration sidebar group", status: "Shipped", tone: "shipped" },
  { phase: "Phase T1", scope: "Topbar wire-up (search, notifications, account menu)", status: "Shipped", tone: "shipped" },
  { phase: "Phase T2", scope: "Settings page overhaul (9 sections, sticky rail)", status: "Shipped", tone: "shipped" },
  { phase: "Phase T3", scope: "Clients/Sites context-menu parity", status: "Shipped", tone: "shipped" },
  { phase: "Phase T4", scope: "Hardening (api-keys proxy, Django 404, PolicyChip, QSkeleton)", status: "Shipped", tone: "shipped" },
  { phase: "Phase T5", scope: "AppShell-native NotFound (catch-all child route)", status: "Shipped", tone: "shipped" },
  { phase: "Phase T7", scope: "Client / Site / User detail pages", status: "Shipped", tone: "shipped" },
  { phase: "Phase T6", scope: "This page — internal migration tracker", status: "Shipped", tone: "shipped" },
];

interface ListRow {
  label: string;
  meta: string;
}

// Phase Z shipped 2026-05-08 — every item that previously lived here
// (legacy file deletes, /legacy route block, retheme palette, prod nginx
// cache-control header) is now landed. Kept as an empty array so the
// section structure survives if future cutover work reuses it.
const outstanding: ListRow[] = [];

const deferredBackend: ListRow[] = [
  {
    label: "PATCH /alerts/ siteFilter param (~3 lines)",
    meta: "T7-flagged — Site-scope alerts currently fetched via client filter and JS-filtered.",
  },
  {
    label: "MeshCentral verify-connection endpoint",
    meta: "T2-flagged — would let the Settings page surface a live mesh link state.",
  },
  {
    label: "get_certs() friendlier error on single-segment ALLOWED_HOSTS",
    meta: "T4-flagged — current trace is opaque; cosmetic improvement only.",
  },
  {
    label: "/v2/logout/ alias for naming consistency",
    meta: "T1-flagged — current /logout/ works fine; this is purely about API surface symmetry.",
  },
  {
    label: "/users/:id full route vs drawer-only",
    meta: "T7 chose drawer-only via /users?openSelf=1. Revisit only if user feedback demands deep links.",
  },
];

const outOfScope: ListRow[] = [
  {
    label: "WinGet support",
    meta: "Phase H ripped this out permanently. Software stack is Choco-only.",
  },
  {
    label: "EE Reporting context-menu submenu",
    meta: "Considered during Phase T3; defer review to Phase Z. May stay deferred indefinitely.",
  },
  {
    label: "Multiplayer 3D Monopoly project",
    meta: "Different project entirely. Listed here so the boundary is explicit and nobody migrates anything by mistake.",
  },
];

const prereqs: ListRow[] = [
  {
    label: "Every legacy nav target has a modern AppShell equivalent",
    meta: "Verified across Phases A–T7 — sidebar covers Overview, Manage, Operations, Insights, Administration, Configure.",
  },
  {
    label: "Every legacy menubar setting has a section in /settings",
    meta: "Phase T2 SettingsPage covers all 9 sections from the original CoreSettings + URL Actions + Custom Fields.",
  },
  {
    label: "Every legacy right-click op has a row-context entry",
    meta: "Phase T3 ported Clients/Sites context menus. Agent and Devices context menus handled in earlier phases.",
  },
  {
    label: "AppShell-native NotFound is mounted",
    meta: "Phase T5 — :pathMatch(.*)* under AppShell. Unknown URLs render in-shell instead of bouncing to /.",
  },
  {
    label: "Migration status page exists (this page)",
    meta: "Phase T6 — superuser-only, hand-curated, lives at /migration-status.",
  },
];
</script>

<style lang="scss" scoped>
.mig {
  padding: 28px 32px 64px;
  max-width: 1200px;
  margin: 0 auto;

  &__hero {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    max-width: 760px; margin: 0;
    line-height: 1.55;

    code {
      font-family: var(--intune-font-family-mono, monospace);
      font-size: 0.9em;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--color-bg-surface-2);
      color: var(--color-fg-primary);
    }
  }
  &__hero-meta {
    flex-shrink: 0;
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-tertiary);
  }
  &__stamp {
    display: inline-block;
    padding: 4px 10px;
    border-radius: var(--intune-radius-medium);
    background: var(--color-bg-surface-2);
    border: 1px solid var(--color-stroke-divider);
  }

  &__section {
    margin-top: 32px;
  }
  &__h2 {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
  }
  &__sub {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0 0 14px 0;
    max-width: 760px;
    line-height: 1.5;
  }

  &__table-wrap {
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    overflow: hidden;
    background: var(--color-bg-surface);
  }
  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--intune-font-size-300);

    th, td {
      text-align: left;
      padding: 10px 16px;
      border-bottom: 1px solid var(--color-stroke-divider);
    }
    th {
      font-weight: var(--intune-font-weight-semibold);
      color: var(--color-fg-secondary);
      background: var(--color-bg-surface-2);
      font-size: var(--intune-font-size-200);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    tbody tr:last-child td { border-bottom: 0; }
  }
  &__chip {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: var(--intune-font-size-200);
    font-weight: var(--intune-font-weight-semibold);

    &[data-tone="shipped"] {
      background: rgba(16, 124, 16, 0.12);
      color: #107C10;
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-medium);
    background: var(--color-bg-surface);
  }
  &__list-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-stroke-divider);

    &:last-child { border-bottom: 0; }
  }
  &__list-label {
    font-size: var(--intune-font-size-300);
    font-weight: var(--intune-font-weight-semibold);
    color: var(--color-fg-primary);
    margin-bottom: 2px;
  }
  &__list-meta {
    font-size: var(--intune-font-size-200);
    color: var(--color-fg-secondary);
    line-height: 1.45;
  }

  &__icon-todo  { color: var(--color-fg-tertiary); margin-top: 2px; }
  &__icon-defer { color: #C19C00; margin-top: 2px; }
  &__icon-block { color: #A4262C; margin-top: 2px; }
  &__icon-done  { color: #107C10; margin-top: 2px; }
}

[data-theme="dark"] .mig {
  &__chip[data-tone="shipped"] {
    background: rgba(16, 124, 16, 0.22);
    color: #6CCB5F;
  }
  &__icon-defer { color: #E8B33A; }
  &__icon-block { color: #F1707B; }
  &__icon-done  { color: #6CCB5F; }
}
</style>
