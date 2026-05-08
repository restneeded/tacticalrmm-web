// Phase L — Scripts library table column definitions.
// Lifted into a standalone module so the column picker, filter bar,
// and the table itself share a single source of truth.

import type { QTableProps } from "quasar";

export interface TableColumn {
  name: string;
  label: string;
  field: string | ((row: Record<string, unknown>) => unknown);
  sortable?: boolean;
  align?: "left" | "right" | "center";
  required?: boolean;
}

export const SCRIPT_COLUMNS: TableColumn[] = [
  { name: "favorite",     label: "",                field: "favorite",            sortable: true,  align: "center", required: true },
  { name: "name",         label: "Name",            field: "name",                sortable: true,  align: "left",   required: true },
  { name: "shell",        label: "Shell",           field: "shell",               sortable: true,  align: "left" },
  { name: "category",     label: "Category",        field: "category",            sortable: true,  align: "left" },
  { name: "syntax",       label: "Type",            field: "script_type",         sortable: true,  align: "left" },
  { name: "last_run",     label: "Last run",        field: "last_run",            sortable: true,  align: "left" },
  { name: "last_result",  label: "Last result",     field: "last_result",         sortable: true,  align: "left" },
  { name: "run_count",    label: "Runs",            field: "run_count",           sortable: true,  align: "right" },
  { name: "hidden",       label: "Hidden",          field: "hidden",              sortable: true,  align: "center" },
  { name: "supported",    label: "Platforms",       field: "supported_platforms", sortable: false, align: "left" },
];

export const QTABLE_SCRIPT_COLUMNS: QTableProps["columns"] = SCRIPT_COLUMNS.map((c) => ({
  name: c.name,
  label: c.label,
  field: c.field as never,
  sortable: c.sortable,
  align: c.align,
  required: c.required,
}));

export const SHELL_LABELS: Record<string, string> = {
  powershell: "PowerShell",
  cmd:        "Batch (CMD)",
  python:     "Python",
  shell:      "Shell",
  nushell:    "Nushell",
  deno:       "Deno",
};

export const SHELL_OPTIONS = Object.entries(SHELL_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// monaco language id by shell
export const SHELL_TO_MONACO: Record<string, string> = {
  powershell: "powershell",
  cmd:        "bat",
  python:     "python",
  shell:      "shell",
  nushell:    "shell",
  deno:       "typescript",
};

export const SCRIPT_TYPE_LABELS: Record<string, string> = {
  userdefined: "User",
  builtin:     "Built-in",
};
