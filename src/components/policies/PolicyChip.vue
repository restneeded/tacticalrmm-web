<!--
  PolicyChip — small clickable badge linking to /policies/:id.

  Used wherever a policy reference appears: assignments overview,
  Phase J Agent Detail "Inherited from policies" rows, Phase M/N
  library "target" cells.
-->
<template>
  <router-link
    v-if="policyId"
    :to="{ name: 'PolicyDetail', params: { id: policyId } }"
    class="pchip"
    :class="{ 'pchip--inherited': inherited }"
    @click.stop
  >
    <q-icon name="policy" size="13px" class="pchip__ic" />
    <span class="pchip__label">{{ name || `Policy #${policyId}` }}</span>
    <span v-if="inherited && inheritedFrom" class="pchip__from">
      via {{ inheritedFrom }}
    </span>
  </router-link>
  <span v-else class="pchip__muted">—</span>
</template>

<script setup>
defineProps({
  policyId: { type: [Number, String], default: null },
  name:     { type: String, default: "" },
  inherited:    { type: Boolean, default: false },
  inheritedFrom:{ type: String, default: "" },
});
</script>

<style lang="scss" scoped>
.pchip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  color: var(--color-link, #1c70d8);
  background: var(--color-state-info-bg, #e7f0fb);
  border: 1px solid transparent;
  transition: background-color 60ms ease;

  &:hover { background: var(--color-state-info-bg-hover, #d6e6f8); }
  &--inherited {
    background: transparent;
    border-color: var(--color-border-subtle);
    color: var(--color-fg-secondary);
  }
  &__ic { color: inherit; }
  &__label { line-height: 1; }
  &__from {
    color: var(--color-fg-tertiary);
    font-style: italic;
    margin-left: 4px;
    font-size: 11px;
  }
  &__muted {
    color: var(--color-fg-tertiary);
  }
}
</style>
