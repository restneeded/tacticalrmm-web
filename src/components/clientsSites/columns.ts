// Phase I — column definitions for the Clients & Sites table.
// Source of truth shared between the FilterBar (column picker) and the table.

import type { QTableProps } from "quasar";

export interface SiteRow {
  // Stable ids
  site_id: number;
  client_id: number;

  // From /clients/sites/
  site_name: string;
  client_name: string;
  agent_count: number;
  failing_checks: number;
  maintenance_mode: boolean;

  // Derived from /agents/?detail=true (computed in store getter)
  workstations_total: number;
  workstations_online: number;
  servers_total: number;
  servers_online: number;
  patches_pending: number;
  last_seen: string | null;        // ISO; max across the site's agents
}

export interface TableColumn {
  name: string;
  label: string;
  field: string | ((row: SiteRow) => unknown);
  sortable?: boolean;
  align?: "left" | "right" | "center";
  required?: boolean;
}

export const TABLE_COLUMNS: TableColumn[] = [
  { name: "client_name",        label: "Client",          field: "client_name",        sortable: true, align: "left",   required: true },
  { name: "site_name",          label: "Site",            field: "site_name",          sortable: true, align: "left",   required: true },
  { name: "workstations",       label: "Workstations",    field: "workstations_total", sortable: true, align: "left"  },
  { name: "servers",            label: "Servers",         field: "servers_total",      sortable: true, align: "left"  },
  { name: "agent_count",        label: "Total agents",    field: "agent_count",        sortable: true, align: "right" },
  { name: "failing_checks",     label: "Failing checks",  field: "failing_checks",     sortable: true, align: "right" },
  { name: "patches_pending",    label: "Patches pending", field: "patches_pending",    sortable: true, align: "right" },
  { name: "last_seen",          label: "Last check-in",   field: "last_seen",          sortable: true, align: "left"  },
  { name: "maintenance_mode",   label: "Maintenance",     field: "maintenance_mode",   sortable: true, align: "center" },
];

export const QTABLE_COLUMNS: QTableProps["columns"] = TABLE_COLUMNS.map((c) => ({
  name: c.name,
  label: c.label,
  field: c.field as never,
  sortable: c.sortable,
  align: c.align,
  required: c.required,
}));

// Grouped-by-Client mode reuses these but the Site col disappears and Total
// rolls up. The component handles the swap; the column set stays declared here.
