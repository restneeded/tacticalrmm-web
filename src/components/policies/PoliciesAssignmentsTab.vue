<!--
  PoliciesAssignmentsTab — Phase O fleet-wide assignments overview.

  Backend: GET /automation/policies/overview/  — returns the client/site
  tree with each level's currently-bound workstation_policy +
  server_policy. We flatten that into a target-by-target table so admins
  can audit "which policy applies where" at a glance.

  No agent-level rows here (the per-agent inheritance resolution is
  computed lazily server-side and the overview endpoint stops at sites).
  Agent-specific assignments live on the policy detail page's
  Assignments section and on the Agent Detail Automation tab (Phase J).
-->
<template>
  <div class="ov">
    <header class="ov__bar">
      <q-input
        v-model="search"
        dense outlined clearable
        placeholder="Search clients, sites, or policies…"
        class="ov__search"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown flat no-caps icon="filter_list" :label="filterLabel" class="ov__filter">
        <q-list dense style="min-width: 220px;">
          <q-item-label header>Target type</q-item-label>
          <q-item clickable @click="filter.type = 'all'" :active="filter.type === 'all'">
            <q-item-section>All</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === 'all'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.type = 'client'" :active="filter.type === 'client'">
            <q-item-section>Clients</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === 'client'" name="check" /></q-item-section>
          </q-item>
          <q-item clickable @click="filter.type = 'site'" :active="filter.type === 'site'">
            <q-item-section>Sites</q-item-section>
            <q-item-section side><q-icon v-if="filter.type === 'site'" name="check" /></q-item-section>
          </q-item>
          <q-separator spaced />
          <q-item clickable @click="filter.assignedOnly = !filter.assignedOnly">
            <q-item-section>Assigned only</q-item-section>
            <q-item-section side><q-toggle v-model="filter.assignedOnly" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-space />
      <q-btn flat dense icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </header>

    <div v-if="loading && rows.length === 0" class="ov__state">Loading assignments…</div>
    <div v-else-if="errorMsg && rows.length === 0" class="ov__state ov__state--error">
      <q-icon name="error_outline" /> {{ errorMsg }}
    </div>
    <div v-else-if="filteredRows.length === 0" class="ov__state ov__state--empty">
      <q-icon name="account_tree" size="36px" />
      <p v-if="rows.length === 0">No clients yet — create one under Clients & Sites first.</p>
      <p v-else>No assignments match your filters.</p>
    </div>

    <q-table
      v-else
      :rows="filteredRows"
      :columns="columns"
      :pagination="pagination"
      flat dense
      class="ov__tbl"
      :rows-per-page-options="[25, 50, 100, 200, 500]"
      row-key="key"
    >
      <template #body-cell-target="p">
        <q-td :props="p">
          <q-icon :name="p.row.type === 'client' ? 'business' : 'place'" size="14px" class="ov__type-ic" />
          <span class="ov__name">{{ p.row.name }}</span>
          <span v-if="p.row.type === 'site'" class="ov__sub"> · {{ p.row.client_name }}</span>
        </q-td>
      </template>
      <template #body-cell-workstation="p">
        <q-td :props="p">
          <PolicyChip
            v-if="p.row.workstation_policy"
            :policy-id="p.row.workstation_policy.id"
            :name="p.row.workstation_policy.name"
            :inherited="false"
          />
          <span v-else class="ov__muted">—</span>
        </q-td>
      </template>
      <template #body-cell-server="p">
        <q-td :props="p">
          <PolicyChip
            v-if="p.row.server_policy"
            :policy-id="p.row.server_policy.id"
            :name="p.row.server_policy.name"
            :inherited="false"
          />
          <span v-else class="ov__muted">—</span>
        </q-td>
      </template>
    </q-table>

    <div class="ov__footer" v-if="rows.length">
      Showing {{ filteredRows.length }} of {{ rows.length }} targets
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchPolicyOverview } from "@/api/automation";
import PolicyChip from "./PolicyChip.vue";

const rows     = ref([]);
const loading  = ref(false);
const errorMsg = ref("");

const search = ref("");
const filter = ref({ type: "all", assignedOnly: false });
const pagination = { rowsPerPage: 50 };

defineExpose({ reload });

async function reload() {
  loading.value = true; errorMsg.value = "";
  try {
    const data = await fetchPolicyOverview();
    // The backend ships clients with nested sites. Flatten to one row per
    // target with its currently-bound policies. We surface clients and
    // sites; per-agent rows would explode the table for no benefit on
    // the audit path.
    const flat = [];
    for (const c of data || []) {
      flat.push({
        key: `c:${c.pk}`,
        type: "client",
        id: c.pk,
        name: c.name,
        client_name: "",
        workstation_policy: c.workstation_policy
          ? { id: c.workstation_policy.id ?? c.workstation_policy.pk, name: c.workstation_policy.name } : null,
        server_policy: c.server_policy
          ? { id: c.server_policy.id ?? c.server_policy.pk, name: c.server_policy.name } : null,
      });
      for (const s of c.sites || []) {
        flat.push({
          key: `s:${s.pk}`,
          type: "site",
          id: s.pk,
          name: s.name,
          client_name: c.name,
          workstation_policy: s.workstation_policy
            ? { id: s.workstation_policy.id ?? s.workstation_policy.pk, name: s.workstation_policy.name } : null,
          server_policy: s.server_policy
            ? { id: s.server_policy.id ?? s.server_policy.pk, name: s.server_policy.name } : null,
        });
      }
    }
    rows.value = flat;
  } catch (e) {
    errorMsg.value = e?.response?.data?.detail || e?.message || "Couldn't load overview";
  }
  loading.value = false;
}

onMounted(reload);

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (filter.value.type !== "all" && r.type !== filter.value.type) return false;
    if (filter.value.assignedOnly && !r.workstation_policy && !r.server_policy) return false;
    if (q) {
      const hay = `${r.name} ${r.client_name || ""} ${r.workstation_policy?.name || ""} ${r.server_policy?.name || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

const filterLabel = computed(() => {
  const parts = [];
  if (filter.value.type !== "all") parts.push(filter.value.type === "client" ? "clients" : "sites");
  if (filter.value.assignedOnly)   parts.push("assigned");
  return parts.length === 0 ? "Filter" : parts.join(" · ");
});

const columns = computed(() => [
  { name: "target",      label: "Target",     field: "name", align: "left", sortable: true },
  { name: "workstation", label: "Workstation policy", field: (r) => r.workstation_policy?.name, align: "left" },
  { name: "server",      label: "Server policy",      field: (r) => r.server_policy?.name,      align: "left" },
]);
</script>

<style lang="scss" scoped>
.ov {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  &__search { min-width: 240px; flex: 1 1 240px; max-width: 380px; }

  &__state {
    padding: 36px 16px;
    color: var(--color-fg-secondary);
    text-align: center;
    background: var(--color-bg-surface);
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    &--error { color: var(--color-state-negative-fg, #a40e26); }
    p { margin: 0; max-width: 540px; }
  }

  &__tbl {
    background: var(--color-bg-surface);
    :deep(tbody td) { padding: 6px 10px; }
  }
  &__type-ic {
    margin-right: 6px;
    color: var(--color-fg-secondary);
  }
  &__name { font-weight: 500; }
  &__sub  { color: var(--color-fg-secondary); font-size: 12px; margin-left: 6px; }
  &__muted { color: var(--color-fg-tertiary); }
  &__footer {
    color: var(--color-fg-secondary);
    font-size: 12px;
    padding: 6px 4px;
  }
}
</style>
