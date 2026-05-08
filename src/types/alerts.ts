// Phase P — alerts type definitions.
//
// Mirrors backend tacticalrmm/api/.../alerts/{models,serializers}.py.
// AlertTemplate fields preserved exactly; the Phase O picker already uses
// the existing shape so we extend rather than rewrite.

export type AlertSeverity = "error" | "warning" | "info";
export type ActionType = "script" | "server" | "rest";
export type AlertType = "availability" | "check" | "task" | "custom";

// Row returned by GET /alerts/ + GET /alerts/<pk>/.
export interface AlertRow {
  id: number;
  agent: number | null;
  hostname: string | null;
  agent_id: string | null;
  client: string | null;
  site: string | null;
  assigned_check: number | null;
  assigned_task: number | null;
  alert_type: AlertType;
  message: string | null;
  alert_time: string | null;
  snoozed: boolean;
  snooze_until: string | null;
  resolved: boolean;
  resolved_on: string | null;
  severity: AlertSeverity;
  email_sent: string | null;
  resolved_email_sent: string | null;
  sms_sent: string | null;
  resolved_sms_sent: string | null;
  hidden: boolean;
  action_run: string | null;
  action_stdout: string | null;
  action_stderr: string | null;
  action_retcode: number | null;
  action_execution_time: string | null;
  resolved_action_run: string | null;
  resolved_action_stdout: string | null;
  resolved_action_stderr: string | null;
  resolved_action_retcode: number | null;
  resolved_action_execution_time: string | null;
}

export interface AlertListFilter {
  timeFilter?: number;
  clientFilter?: number[];
  siteFilter?: number[];
  severityFilter?: AlertSeverity[];
  resolvedFilter?: boolean;
  snoozedFilter?: boolean;
}

export interface AlertTemplate {
  id: number;
  name: string;
  is_active: boolean;
  action_type: ActionType;
  action?: number | null;
  action_rest?: number | null;
  action_args: string[];
  action_env_vars: string[];
  action_timeout: number;
  resolved_action_type: ActionType;
  resolved_action?: number | null;
  resolved_action_rest?: number | null;
  resolved_action_args: string[];
  resolved_action_env_vars: string[];
  resolved_action_timeout: number;
  email_recipients: string[];
  email_from: string;
  text_recipients: string[];

  agent_email_on_resolved: boolean;
  agent_text_on_resolved: boolean;
  agent_always_email: boolean | null;
  agent_always_text: boolean | null;
  agent_always_alert: boolean | null;
  agent_periodic_alert_days: number;
  agent_script_actions: boolean;

  check_email_alert_severity: AlertSeverity[];
  check_text_alert_severity: AlertSeverity[];
  check_dashboard_alert_severity: AlertSeverity[];
  check_email_on_resolved: boolean;
  check_text_on_resolved: boolean;
  check_always_email: boolean | null;
  check_always_text: boolean | null;
  check_always_alert: boolean | null;
  check_periodic_alert_days: number;
  check_script_actions: boolean;

  task_email_alert_severity: AlertSeverity[];
  task_text_alert_severity: AlertSeverity[];
  task_dashboard_alert_severity: AlertSeverity[];
  task_email_on_resolved: boolean;
  task_text_on_resolved: boolean;
  task_always_email: boolean | null;
  task_always_text: boolean | null;
  task_always_alert: boolean | null;
  task_periodic_alert_days: number;
  task_script_actions: boolean;

  exclude_workstations?: boolean;
  exclude_servers?: boolean;
  excluded_sites?: number[];
  excluded_clients?: number[];
  excluded_agents?: string[];

  // Read-only computed fields supplied by the backend serializer.
  applied_count?: number;
  agent_settings?: boolean;
  check_settings?: boolean;
  task_settings?: boolean;
  core_settings?: boolean;
  default_template?: boolean;
  action_name?: string;
  resolved_action_name?: string;
}

export interface AlertTemplateRelated extends AlertTemplate {
  policies: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  sites: { id: number; name: string; client?: { id: number; name: string } }[];
}
