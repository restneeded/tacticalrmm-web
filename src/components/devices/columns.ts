// Phase C — table column definitions.
// Lifted into a standalone module so the FilterBar (column picker) and the
// DevicesTable share a single source of truth.

import type { QTableProps } from "quasar";

export interface TableColumn {
  name: string;
  label: string;
  field: string | ((row: Record<string, unknown>) => unknown);
  sortable?: boolean;
  align?: "left" | "right" | "center";
  required?: boolean;
}

export const TABLE_COLUMNS: TableColumn[] = [
  { name: "status",          label: "",                field: "status",            sortable: true,  align: "left",  required: true  },
  { name: "hostname",        label: "Hostname",        field: "hostname",          sortable: true,  align: "left",  required: true  },
  { name: "client_name",     label: "Client",          field: "client_name",       sortable: true,  align: "left"  },
  { name: "site_name",       label: "Site",            field: "site_name",         sortable: true,  align: "left"  },
  { name: "monitoring_type", label: "Type",            field: "monitoring_type",   sortable: true,  align: "left"  },
  { name: "operating_system",label: "OS",              field: "operating_system",  sortable: true,  align: "left"  },
  { name: "logged_username", label: "User",            field: "logged_username",   sortable: true,  align: "left"  },
  { name: "public_ip",       label: "Public IP",       field: "public_ip",         sortable: true,  align: "left"  },
  { name: "version",         label: "Agent ver.",      field: "version",           sortable: true,  align: "left"  },
  { name: "checks_failing",  label: "Checks failing",  field: (r) => (r.checks as { failing?: number })?.failing ?? 0, sortable: true, align: "right" },
  { name: "needs_reboot",    label: "Reboot",          field: "needs_reboot",      sortable: true,  align: "center" },
  { name: "last_seen",       label: "Last seen",       field: "last_seen",         sortable: true,  align: "left"  },
  { name: "description",     label: "Description",     field: "description",      sortable: true,  align: "left"  },
];

// q-table understands the column type already; we reshape just enough for it.
export const QTABLE_COLUMNS: QTableProps["columns"] = TABLE_COLUMNS.map((c) => ({
  name: c.name,
  label: c.label,
  field: c.field as never,
  sortable: c.sortable,
  align: c.align,
  required: c.required,
}));
