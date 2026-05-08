<!--
  Phase I — saved-views menu (mirrors devices/SavedViewsMenu).
-->
<template>
  <q-btn
    flat
    no-caps
    icon="bookmark"
    icon-right="arrow_drop_down"
    class="csvm__btn"
    :label="active?.name || 'Saved views'"
  >
    <q-menu anchor="bottom left" self="top left">
      <q-list dense style="min-width: 280px;">
        <q-item-label header>Built-in</q-item-label>
        <q-item
          v-for="v in views.builtin"
          :key="v.id"
          clickable
          v-close-popup
          @click="apply(v)"
          :active="active?.id === v.id"
        >
          <q-item-section avatar><q-icon name="auto_awesome" size="18px" /></q-item-section>
          <q-item-section>{{ v.name }}</q-item-section>
        </q-item>

        <q-separator spaced />

        <q-item-label header>
          Your views
          <span v-if="views.user.length === 0" class="csvm__empty">— none yet</span>
        </q-item-label>
        <q-item
          v-for="v in views.user"
          :key="v.id"
          clickable
          @click="apply(v)"
          :active="active?.id === v.id"
        >
          <q-item-section avatar><q-icon name="bookmark" size="18px" /></q-item-section>
          <q-item-section>
            {{ v.name }}
            <q-badge
              v-if="v.isShared"
              color="primary"
              text-color="white"
              class="csvm__shared-badge"
            >
              shared
            </q-badge>
          </q-item-section>
          <q-item-section side>
            <div class="csvm__row-actions">
              <q-btn
                v-if="v.serverId !== undefined"
                flat dense round
                :icon="v.isShared ? 'group' : 'person'"
                size="sm"
                :aria-label="v.isShared ? 'Unshare view' : 'Share with team'"
                @click.stop="toggleShared(v)"
              >
                <q-tooltip>{{ v.isShared ? 'Unshare' : 'Share with team' }}</q-tooltip>
              </q-btn>
              <q-btn
                flat dense round
                icon="delete"
                size="sm"
                :aria-label="`Delete saved view ${v.name}`"
                @click.stop="views.remove(v.id)"
              />
            </div>
          </q-item-section>
        </q-item>

        <q-separator spaced />

        <div class="csvm__save">
          <q-input
            v-model="newName"
            outlined
            dense
            label="Save current view as…"
            class="csvm__save-input"
            @keydown.enter="save"
          />
          <q-toggle
            v-model="newShared"
            label="Share with team"
            class="csvm__share-toggle"
          />
          <q-btn
            unelevated
            dense
            color="primary"
            label="Save"
            :disable="!newName.trim()"
            @click="save"
          />
        </div>
        <div v-if="views.lastSyncError" class="csvm__error">
          Sync error: {{ views.lastSyncError }}
        </div>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useClientsSitesStore } from "@/stores/clientsSites";
import { useClientsSitesViewStore, type ClientsSitesView } from "@/stores/clientsSitesView";

const emit = defineEmits<{ (e: "apply", v: ClientsSitesView): void }>();

const store = useClientsSitesStore();
const views = useClientsSitesViewStore();
const active = computed(() => views.activeView);

const newName = ref("");
const newShared = ref(false);

onMounted(() => views.syncFromServer());

function apply(v: ClientsSitesView) {
  views.setActive(v.id);
  emit("apply", v);
}

async function save() {
  const name = newName.value.trim();
  if (!name) return;
  const v = await views.save(
    name,
    {
      filters: { ...store.filters },
      sort: { ...store.sort },
      visibleColumns: [...store.visibleColumns],
      density: store.density,
      groupByClient: store.groupByClient,
    },
    { isShared: newShared.value },
  );
  newName.value = "";
  newShared.value = false;
  views.setActive(v.id);
}

function toggleShared(v: ClientsSitesView) {
  if (v.serverId === undefined) return;
  void views.setShared(v.id, !v.isShared);
}
</script>

<style lang="scss" scoped>
.csvm__btn {
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  padding: 4px 10px;
  font-weight: var(--intune-font-weight-medium);
  height: 36px;
}
.csvm__empty {
  color: var(--color-fg-tertiary);
  font-weight: 400;
  margin-left: 4px;
}
.csvm__save {
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px 12px;
  align-items: center;
}
.csvm__save-input { flex: 1; }
.csvm__error {
  padding: 0 12px 8px;
  color: var(--color-status-negative-fg);
  font-size: var(--intune-font-size-100);
}
.csvm__row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.csvm__shared-badge {
  margin-left: 6px;
}
</style>
