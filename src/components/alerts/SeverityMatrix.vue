<!--
  SeverityMatrix — Phase P 3-channel × 3-severity checkbox matrix.

  Used by AlertTemplateDetailPage for the Check-alerts and Task-alerts
  blocks. Backend stores three independent ArrayFields per channel
  (email_alert_severity, text_alert_severity, dashboard_alert_severity),
  so we keep the v-model split per channel rather than collapsing into a
  single object — that way the parent passes-through to the template
  payload unchanged.
-->
<template>
  <div class="sm">
    <table class="sm__tbl">
      <thead>
        <tr>
          <th class="sm__corner"></th>
          <th v-for="c in channels" :key="c.value" class="sm__chead">
            <q-icon :name="c.icon" size="14px" /> {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in severities" :key="s.value">
          <th class="sm__rhead">
            <SeverityChip :severity="s.value" :label="s.label" />
          </th>
          <td v-for="c in channels" :key="c.value">
            <q-checkbox
              :model-value="isChecked(c.value, s.value)"
              dense
              size="xs"
              @update:model-value="(v) => set(c.value, s.value, v)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import SeverityChip from "@/components/alerts/SeverityChip.vue";

const props = defineProps({
  email:     { type: Array, default: () => [] },
  sms:       { type: Array, default: () => [] },
  dashboard: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:email", "update:sms", "update:dashboard"]);

const channels = [
  { value: "email",     label: "Email",     icon: "mail" },
  { value: "sms",       label: "SMS",       icon: "sms" },
  { value: "dashboard", label: "Dashboard", icon: "dashboard" },
];
const severities = [
  { value: "error",   label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info",    label: "Info" },
];

function arr(channel) {
  if (channel === "email")     return props.email     ?? [];
  if (channel === "sms")       return props.sms       ?? [];
  if (channel === "dashboard") return props.dashboard ?? [];
  return [];
}
function isChecked(channel, sev) {
  return arr(channel).includes(sev);
}
function set(channel, sev, v) {
  const cur = [...arr(channel)];
  const i = cur.indexOf(sev);
  if (v && i < 0) cur.push(sev);
  if (!v && i >= 0) cur.splice(i, 1);
  if (channel === "email")     emit("update:email", cur);
  if (channel === "sms")       emit("update:sms", cur);
  if (channel === "dashboard") emit("update:dashboard", cur);
}
</script>

<style lang="scss" scoped>
.sm {
  margin: 6px 0 12px;

  &__tbl {
    border-collapse: collapse;
    th, td {
      padding: 6px 12px;
      text-align: center;
    }
  }
  &__corner { background: transparent; }
  &__chead {
    font-weight: 600;
    color: var(--color-fg-secondary);
    text-transform: none;
    font-size: 12px;
    border-bottom: 1px solid var(--color-stroke-divider);
  }
  &__rhead {
    text-align: left;
    font-weight: 500;
    padding-right: 16px;
  }
  tbody tr td { vertical-align: middle; }
}
</style>
