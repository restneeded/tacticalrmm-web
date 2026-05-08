// Phase T2 — full CoreSettings shape used by the modern /settings page.
//
// The `CoreSetting` interface stays additive — older callers that read
// only a few fields (ReportScheduleForm, InitialSetup) still type-check.
// All fields here mirror the Django CoreSettings model.

export interface CoreSetting {
  // existing fields kept for compat
  block_local_user_logon: boolean;
  all_timezones: string[];
  default_time_zone: string;
  email_alert_recipients: string[];

  // — General —
  date_format?: string;
  agent_auto_update?: boolean;
  sso_enabled?: boolean;
  enable_server_scripts?: boolean;
  enable_server_webterminal?: boolean;

  // — SMTP —
  smtp_host?: string;
  smtp_port?: number;
  smtp_requires_auth?: boolean;
  smtp_host_user?: string;
  smtp_host_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string | null;

  // — Twilio —
  twilio_account_sid?: string | null;
  twilio_auth_token?: string | null;
  twilio_number?: string | null;
  sms_alert_recipients?: string[];

  // — Mesh —
  mesh_username?: string | null;
  mesh_token?: string | null;
  mesh_site?: string | null;
  mesh_device_group?: string | null;
  mesh_company_name?: string | null;
  sync_mesh_with_trmm?: boolean;

  // — Default policies —
  server_policy?: number | null;
  workstation_policy?: number | null;

  // — Alerts —
  alert_template?: number | null;
  notify_on_info_alerts?: boolean;
  notify_on_warning_alerts?: boolean;
}
