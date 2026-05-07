<!--
  SavedViewsMenu — dropdown of built-in + user views, with a "Save current"
  inline form. Persistence lives in stores/devicesView.ts (localStorage).
-->
<template>
  <q-btn
    flat
    no-caps
    icon="bookmark"
    icon-right="arrow_drop_down"
    class="svm__btn"
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
          <span v-if="views.user.length === 0" class="svm__empty">— none yet</span>
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
              class="svm__shared-badge"
            >
              shared
            </q-badge>
          </q-item-section>
          <q-item-section side>
            <div class="svm__row-actions">
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

        <div class="svm__save">
          <q-input
            v-model="newName"
            outlined
            dense
            label="Save current view as…"
            class="svm__save-input"
            @keydown.enter="save"
          />
          <q-toggle
            v-model="newShared"
            label="Share with team"
            class="svm__share-toggle"
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
        <div v-if="views.lastSyncError" class="svm__error">
          Sync error: {{ views.lastSyncError }}
        </div>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useDevicesStore } from "@/stores/devices";
import { useDevicesViewStore, type DevicesView } from "@/stores/devicesView";

const emit = defineEmits<{ (e: "apply", v: DevicesView): void }>();

const store = useDevicesStore();
const views = useDevicesViewStore();
const active = computed(() => views.activeView);

const newName = ref("");
const newShared = ref(false);

// Phase G — pull saved views from the server on mount. The store also
// runs a one-shot localStorage→server migration the first time it's
// called per browser, so users keep the views they had before this
// release.
onMounted(() => views.syncFromServer());

function apply(v: DevicesView) {
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
    },
    { isShared: newShared.value },
  );
  newName.value = "";
  newShared.value = false;
  views.setActive(v.id);
}

function toggleShared(v: DevicesView) {
  if (v.serverId === undefined) return;  // can't share local-only views
  void views.setShared(v.id, !v.isShared);
}
</script>

<style lang="scss" scoped>
.svm__btn {
  border: 1px solid var(--color-stroke-divider);
  border-radius: var(--intune-radius-medium);
  padding: 4px 10px;
  font-weight: var(--intune-font-weight-medium);
  height: 36px;
}
.svm__empty {
  color: var(--color-fg-tertiary);
  font-weight: 400;
  margin-left: 4px;
}
.svm__save {
  display: flex;
  gap: 8px;
  padding: 8px 12px 12px 12px;
  align-items: center;
}
.svm__save-input { flex: 1; }
</style>
