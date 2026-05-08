// Phase T2 — extended CustomField shape covering the full /core/customfields/
// payload. The narrow `CustomField` interface kept by Phase pre-T2 callers
// (just id/model/name/type/required/default_value) still type-checks.

export type CustomFieldModel = "agent" | "client" | "site";
export type CustomFieldType =
  | "text"
  | "number"
  | "single"
  | "multiple"
  | "checkbox"
  | "datetime";

export interface CustomField {
  id: number;
  model: CustomFieldModel;
  name: string;
  type: CustomFieldType | string;
  required: boolean;
  default_value: string | boolean | number | string[];

  order?: number;
  options?: string[] | null;
  default_value_string?: string | null;
  default_value_bool?: boolean;
  default_values_multiple?: string[] | null;
  hide_in_ui?: boolean;
  hide_in_summary?: boolean;
}

export interface CustomFieldValue {
  [x: string]: string | boolean | number | string[];
}
