<!--
  Phase T2 — Settings.

  This page is the modern home for everything the legacy menubar
  configuration screens used to host. It is rendered as one page with
  a sticky left rail of section anchors + scroll-spy in the main column.

  Sections (each a child component under @/components/settings/):
    • General         — timezone, date format, agent auto-update
    • SMTP            — outbound email + Send test
    • Twilio          — SMS + Send test
    • MeshCentral     — credentials, device group, sync toggle
    • Install policy  — default server / workstation policies
    • Alert defaults  — default alert template + notification toggles
    • URL Actions     — full CRUD over /core/urlaction/
    • Custom Fields   — full CRUD over /core/customfields/
    • Dashboard tiles — Phase B tile customizer (kept verbatim)

  Permission gating reads from the Phase S perms store (extended in
  Phase T2 with can_view/edit_core_settings, can_view/manage_customfields,
  can_run_urlactions). Users without rights see nothing for that section.
-->
<template>
  <q-page class="settings">
    <header class="settings__hero">
      <h1 class="settings__title">Settings</h1>
      <p class="settings__lede">
        Tenant-wide configuration — integrations, default policies, custom
        fields, URL actions, and your personal dashboard layout.
      </p>
    </header>

    <div class="settings__grid">
      <SettingsRail
        :sections="visibleSections"
        :active="activeId"
        @select="scrollTo"
      />

      <main ref="mainRef" class="settings__main">
        <template v-for="s in visibleSections" :key="s.id">
          <section
            :id="`sec-${s.id}`"
            :data-section-id="s.id"
            class="settings__section-anchor"
          >
            <component :is="s.component" />
          </section>
        </template>
      </main>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { useCurrentUserPermsStore } from "@/stores/permissions";

import SettingsRail from "@/components/settings/SettingsRail.vue";

import GeneralSection from "@/components/settings/GeneralSection.vue";
import SmtpSection from "@/components/settings/SmtpSection.vue";
import TwilioSection from "@/components/settings/TwilioSection.vue";
import MeshSection from "@/components/settings/MeshSection.vue";
import InstallPolicySection from "@/components/settings/InstallPolicySection.vue";
import AlertDefaultsSection from "@/components/settings/AlertDefaultsSection.vue";
import UrlActionsSection from "@/components/settings/UrlActionsSection.vue";
import CustomFieldsSection from "@/components/settings/CustomFieldsSection.vue";
import DashboardTilesSection from "@/components/settings/DashboardTilesSection.vue";

import type { Component } from "vue";

interface SectionDef {
  id: string;
  title: string;
  permKey: keyof ReturnType<typeof useCurrentUserPermsStore>["perms"] | null;
  component: Component;
}

const perms = useCurrentUserPermsStore();
onMounted(() => perms.ensure());

// Section catalog. `permKey: null` means "always visible".
// Tiles are user-personal (not gated). Sections that read CoreSettings
// gate on can_view_core_settings; CRUD-only sections gate on their
// per-domain perms.
const ALL_SECTIONS: SectionDef[] = [
  { id: "general",       title: "General",         permKey: "can_view_core_settings",   component: markRaw(GeneralSection) },
  { id: "smtp",          title: "SMTP / Email",    permKey: "can_view_core_settings",   component: markRaw(SmtpSection) },
  { id: "twilio",        title: "Twilio / SMS",    permKey: "can_view_core_settings",   component: markRaw(TwilioSection) },
  { id: "mesh",          title: "MeshCentral",     permKey: "can_view_core_settings",   component: markRaw(MeshSection) },
  { id: "installpolicy", title: "Install policy",  permKey: "can_view_core_settings",   component: markRaw(InstallPolicySection) },
  { id: "alertdefaults", title: "Alert defaults",  permKey: "can_view_core_settings",   component: markRaw(AlertDefaultsSection) },
  { id: "urlactions",    title: "URL Actions",     permKey: "can_run_urlactions",       component: markRaw(UrlActionsSection) },
  { id: "customfields",  title: "Custom Fields",   permKey: "can_view_customfields",    component: markRaw(CustomFieldsSection) },
  { id: "tiles",         title: "Dashboard tiles", permKey: null,                       component: markRaw(DashboardTilesSection) },
];

const visibleSections = computed<SectionDef[]>(() => {
  return ALL_SECTIONS.filter((s) => {
    if (!s.permKey) return true;
    if (perms.perms.is_superuser) return true;
    return !!perms.perms[s.permKey];
  });
});

// ── Scroll-spy ────────────────────────────────────────────────────────
//
// Standard scroll-spy: a "trigger line" sits at 25% from the viewport top.
// The active section is the one whose top is the most recent (largest)
// to have crossed above the trigger line. This is robust against
// programmatic scrollIntoView (where multiple sections overlap the
// viewport at once) and against perms-driven section list changes.
const mainRef = ref<HTMLElement | null>(null);
const activeId = ref<string>("");

let scrollHandler: (() => void) | null = null;

function recomputeActive() {
  if (!mainRef.value) return;
  const els = Array.from(
    mainRef.value.querySelectorAll<HTMLElement>("[data-section-id]"),
  );
  if (els.length === 0) return;
  const trigger = window.innerHeight * 0.25;
  // Default to first section.
  let bestId = els[0].dataset.sectionId ?? "";
  // Walk in document order; the last section whose top has crossed (top <= trigger) wins.
  for (const el of els) {
    const top = el.getBoundingClientRect().top;
    if (top <= trigger) {
      bestId = el.dataset.sectionId ?? bestId;
    } else {
      break;
    }
  }
  activeId.value = bestId;
}

watch(
  () => visibleSections.value.map((s) => s.id).join("|"),
  async () => {
    await nextTick();
    recomputeActive();
  },
  { immediate: true },
);

onMounted(() => {
  scrollHandler = () => recomputeActive();
  // Capture-phase listener catches scrolls on any ancestor — Quasar's
  // q-layout/q-page-container scrolls an inner element, not window.
  document.addEventListener("scroll", scrollHandler, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", scrollHandler);
});
onUnmounted(() => {
  if (scrollHandler) {
    document.removeEventListener("scroll", scrollHandler, {
      capture: true,
    } as EventListenerOptions);
    window.removeEventListener("resize", scrollHandler);
  }
});

function scrollTo(id: string) {
  const el = document.getElementById(`sec-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  activeId.value = id;
}
</script>

<style lang="scss" scoped>
.settings {
  padding: 28px 32px 64px;
  max-width: 1400px;
  margin: 0 auto;

  &__hero { margin-bottom: 24px; }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.1;
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.4px;
  }
  &__lede {
    font-size: var(--intune-font-size-300);
    color: var(--color-fg-secondary);
    margin: 0;
    max-width: 760px;
  }

  &__grid {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  &__section-anchor {
    // The rail's :is-selected highlight is driven by IntersectionObserver,
    // and we want the section's top edge to count as "in view" once it
    // crosses ~20% of the viewport. The CSS scroll-margin gives clicks
    // from the rail breathing room below the topbar.
    scroll-margin-top: 24px;
  }

  @media (max-width: 880px) {
    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
