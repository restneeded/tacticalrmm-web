<template>
  <q-page padding class="home">
    <header class="home__hero">
      <h1 class="home__title">Tactical RMM, reimagined.</h1>
      <p class="home__lede">
        Phase A: Intune-style design system, theme switching, and a router-driven
        shell are live. The dashboard, devices, software, patching, and reports
        screens land in subsequent phases.
      </p>
      <div class="home__chip-row">
        <span class="home__chip home__chip--ok">Design tokens</span>
        <span class="home__chip home__chip--ok">Theme switcher</span>
        <span class="home__chip home__chip--ok">App shell</span>
        <span class="home__chip home__chip--pending">Devices · Phase&nbsp;C</span>
        <span class="home__chip home__chip--pending">Software · Phase&nbsp;D</span>
        <span class="home__chip home__chip--pending">Patching · Phase&nbsp;F</span>
      </div>
    </header>

    <section class="home__grid">
      <article class="home__card">
        <q-icon name="palette" size="24px" class="home__card-icon" />
        <h2 class="home__card-title">Intune-style palette</h2>
        <p class="home__card-body">
          Anchored on Microsoft Intune's primary blue (#0078D4) and Fluent 2's
          neutral ramp. CSS custom properties drive instant light/dark switching.
        </p>
      </article>

      <article class="home__card">
        <q-icon name="dark_mode" size="24px" class="home__card-icon" />
        <h2 class="home__card-title">Light, dark, and system</h2>
        <p class="home__card-body">
          The theme button in the top bar cycles light → dark → system. Your
          choice is persisted to localStorage and tracked against your OS
          preference.
        </p>
      </article>

      <article class="home__card">
        <q-icon name="route" size="24px" class="home__card-icon" />
        <h2 class="home__card-title">Router-driven shell</h2>
        <p class="home__card-body">
          The 913-line monolith now lives at <code>/legacy</code>. Every
          subsequent phase peels one tab off and lands it as a real route here.
        </p>
      </article>

      <article class="home__card">
        <q-icon name="rocket_launch" size="24px" class="home__card-icon" />
        <h2 class="home__card-title">Killer feature: app takeover</h2>
        <p class="home__card-body">
          Phase D &amp; E will let you socket in to apps already installed on
          your fleet, learn their version posture, and proactively keep them
          aligned. Minimal setup. Understandable in five years.
        </p>
      </article>
    </section>
  </q-page>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.home {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 32px 64px;

  &__hero {
    margin-bottom: 32px;
  }
  &__title {
    font-size: var(--intune-font-size-800);
    font-weight: var(--intune-font-weight-semibold);
    line-height: 1.15;
    margin: 0 0 12px 0;
    color: var(--color-fg-primary);
    letter-spacing: -0.5px;
  }
  &__lede {
    font-size: var(--intune-font-size-400);
    line-height: 1.5;
    color: var(--color-fg-secondary);
    margin: 0 0 20px 0;
    max-width: 760px;
  }
  &__chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  &__chip {
    font-size: var(--intune-font-size-200);
    padding: 4px 10px;
    border-radius: var(--intune-radius-circular);
    font-weight: var(--intune-font-weight-semibold);
    border: 1px solid var(--color-stroke-divider);
    &--ok {
      background-color: rgba(16, 124, 16, 0.1);
      color: var(--intune-status-success);
      border-color: rgba(16, 124, 16, 0.25);
    }
    &--pending {
      background-color: var(--color-bg-surface-2);
      color: var(--color-fg-secondary);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }
  &__card {
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-stroke-divider);
    border-radius: var(--intune-radius-large);
    padding: 20px;
    transition: box-shadow var(--intune-duration-fast) var(--intune-curve-easy-ease),
                border-color var(--intune-duration-fast) var(--intune-curve-easy-ease);
    &:hover {
      box-shadow: var(--intune-shadow-4);
      border-color: var(--color-stroke-control);
    }
  }
  &__card-icon {
    color: var(--color-brand-rest);
    margin-bottom: 8px;
  }
  &__card-title {
    font-size: var(--intune-font-size-500);
    font-weight: var(--intune-font-weight-semibold);
    margin: 0 0 6px 0;
    color: var(--color-fg-primary);
  }
  &__card-body {
    font-size: var(--intune-font-size-300);
    line-height: 1.5;
    color: var(--color-fg-secondary);
    margin: 0;
    code {
      background-color: var(--color-bg-surface-2);
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
    }
  }
}
</style>
