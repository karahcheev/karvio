export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserDto {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  team: string | null;
  is_enabled: boolean;
  role: "user" | "admin";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  project_memberships: UserProjectMembershipDto[];
}

export interface LoginResponseDto {
  user: UserDto;
}

export interface ApiKeyLoginDto {
  authenticated_at: string;
  ip: string | null;
  user_agent: string | null;
  request_path: string | null;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  key_hint: string;
  created_at: string;
  rotated_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  last_used_user_agent: string | null;
  recent_logins: ApiKeyLoginDto[];
}

export interface ApiKeyListDto {
  items: ApiKeyDto[];
}

export interface ApiKeySecretResponseDto {
  api_key: string;
  key: ApiKeyDto;
}

export interface VersionDto {
  version: string;
}

export type NotificationChannel = "email" | "slack" | "mattermost";
export type NotificationRuleType = "test_run_report" | "alerting";

export interface SmtpSettingsDto {
  enabled: boolean;
  host: string;
  port: number;
  username: string | null;
  password_configured: boolean;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  use_tls: boolean;
  use_starttls: boolean;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface SmtpEnabledDto {
  enabled: boolean;
}

export interface NotificationRecipientsChannelDto {
  enabled: boolean;
  recipients: string[];
}

export interface NotificationWebhookChannelDto {
  enabled: boolean;
  webhook_url: string | null;
  channel_name: string | null;
}

export interface ProjectNotificationRuleSettingsDto {
  enabled: boolean;
  email: NotificationRecipientsChannelDto;
  slack: NotificationWebhookChannelDto;
  mattermost: NotificationWebhookChannelDto;
}

export interface ProjectNotificationSettingsDto {
  id: string;
  project_id: string;
  test_run_report: ProjectNotificationRuleSettingsDto;
  alerting: ProjectNotificationRuleSettingsDto;
  created_at: string;
  updated_at: string;
}

export interface NotificationTestResultDto {
  message: string;
}

export type ProjectMemberRole = "viewer" | "tester" | "lead" | "manager";

export interface UserProjectMembershipDto {
  project_id: string;
  project_name: string;
  role: ProjectMemberRole;
}

export interface ProjectMemberDto {
  id: string;
  project_id: string;
  user_id: string;
  username?: string | null;
  role: ProjectMemberRole;
  created_at: string;
}

export interface SuiteDto {
  id: string;
  project_id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  /** Non-archived test cases with suite_id equal to this suite (not including child suites). */
  test_cases_count: number;
  /** Active test cases with suite_id equal to this suite (not including child suites). */
  active_test_cases_count: number;
}

import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";

export type { TestCasePriority, TestCaseTemplateType, TestCaseType };

export type ExternalIssueOwnerType = "run_case" | "test_case" | "test_run";

export interface ExternalIssueLinkDto {
  id: string;
  provider: "jira";
  project_id: string;
  owner_type: ExternalIssueOwnerType;
  owner_id: string;
  external_key: string;
  external_url: string;
  snapshot_status: string | null;
  snapshot_summary: string | null;
  snapshot_priority: string | null;
  snapshot_assignee: string | null;
  snapshot_assignee_account_id: string | null;
  snapshot_last_synced_at: string | null;
  is_invalid: boolean;
  invalid_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestCaseDto {
  id: string;
  project_id: string;
  suite_id: string | null;
  owner_id: string | null;
  primary_product_id?: string | null;
  owner_name?: string | null;
  key: string;
  automation_id?: string | null;
  title: string;
  preconditions: string | null;
  template_type: TestCaseTemplateType;
  steps_text?: string | null;
  expected?: string | null;
  raw_test?: string | null;
  raw_test_language?: string | null;
  time?: string | null;
  priority: TestCasePriority | null;
  status: "draft" | "active" | "archived";
  test_case_type?: TestCaseType;
  tags: string[];
  dataset_bindings?: TestCaseDatasetBindingDto[];
  external_issues?: ExternalIssueLinkDto[];
  variables_used?: string[];
  component_coverages?: TestCaseComponentCoverageDto[];
  suite_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductStatus = "active" | "archived";
export type ComponentRiskLevel = "low" | "medium" | "high" | "critical";
export type CoverageType = "direct" | "indirect" | "integration" | "e2e";
export type CoverageStrength = "smoke" | "regression" | "deep";
export type PlanGenerationMode = "smoke" | "regression" | "full";

export interface TestCaseComponentCoverageDto {
  id: string;
  test_case_id: string;
  component_id: string;
  coverage_type: CoverageType;
  coverage_strength: CoverageStrength;
  is_mandatory_for_release: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DatasetStatus = "active" | "archived";
export type DatasetBindingMode = "follow_latest" | "pin_revision";
export type DatasetRowSelectionType = "all" | "subset";

export interface DatasetColumnDto {
  id: string;
  column_key: string;
  display_name: string;
  data_type: string;
  required: boolean;
  default_value: string | null;
  order_index: number;
  is_scenario_label: boolean;
}

export interface DatasetRowDto {
  id: string;
  row_key: string;
  scenario_label: string | null;
  order_index: number;
  values: Record<string, unknown>;
  is_active: boolean;
}

export interface DatasetRevisionDto {
  id: string;
  dataset_id: string;
  revision_number: number;
  rows_count: number;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
  columns: DatasetColumnDto[];
  rows: DatasetRowDto[];
}

export interface TestCaseDatasetBindingDto {
  id: string;
  test_case_id: string;
  dataset_id: string;
  dataset_name?: string | null;
  dataset_alias: string;
  mode: DatasetBindingMode;
  pinned_revision_number: number | null;
  row_selection_type: DatasetRowSelectionType;
  selected_row_keys: string[];
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestDatasetDto {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: DatasetStatus;
  source_type: "manual" | "pytest_parametrize" | "imported";
  source_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  current_revision_number: number;
  current_revision_id: string | null;
  current_revision?: DatasetRevisionDto | null;
  test_case_ids: string[];
  test_cases_count: number;
  // legacy optional fields kept to avoid hard break in old UI slices.
  external_key?: string | null;
  data?: Record<string, unknown>;
  schema?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  hash?: string | null;
}

export type TestDatasetBulkAction = "delete";

export interface TestDatasetsBulkPayload {
  project_id: string;
  dataset_ids: string[];
  action: TestDatasetBulkAction;
}

export interface TestDatasetsBulkResult {
  affected_count: number;
}

export interface EnvironmentNodeDto {
  name?: string | null;
  host_type: string;
  role?: string | null;
  provider?: string | null;
  region?: string | null;
  endpoint?: string | null;
  count: number;
  resources: Record<string, unknown>;
  tags: string[];
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EnvironmentComponentDto {
  name: string;
  component_type?: string | null;
  nodes: EnvironmentNodeDto[];
  endpoints: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EnvironmentTopologyDto {
  load_generators: EnvironmentComponentDto[];
  system_under_test: EnvironmentComponentDto[];
  supporting_services: EnvironmentComponentDto[];
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EnvironmentDto {
  id: string;
  project_id: string;
  name: string;
  kind?: string;
  status?: string;
  description: string | null;
  tags: string[];
  use_cases: string[];
  schema_version: number;
  topology: EnvironmentTopologyDto;
  meta: Record<string, unknown>;
  extra?: Record<string, unknown>;
  current_revision_number?: number;
  current_revision_id?: string | null;
  snapshot_hash?: string | null;
  entities_count?: number;
  edges_count?: number;
  topology_component_count?: number;
  topology_node_count?: number;
  topology_endpoint_count?: number;
  infra_host_types?: string[];
  infra_providers?: string[];
  infra_regions?: string[];
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentEntityReadDto {
  id: string;
  entity_key: string;
  entity_type: string;
  name?: string | null;
  role?: string | null;
  spec: Record<string, unknown>;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface EnvironmentEdgeReadDto {
  id: string;
  from_entity_key: string;
  to_entity_key: string;
  relation_type: string;
  spec: Record<string, unknown>;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface EnvironmentRevisionDto {
  id: string;
  environment_id: string;
  revision_number: number;
  schema_version: number;
  is_current: boolean;
  revision_note?: string | null;
  full_snapshot: Record<string, unknown>;
  snapshot_hash: string;
  extra: Record<string, unknown>;
  entities: EnvironmentEntityReadDto[];
  edges: EnvironmentEdgeReadDto[];
  created_by?: string | null;
  created_at: string;
}

export type TestCaseBulkAction =
  | "delete"
  | "move"
  | "set_status"
  | "set_owner"
  | "add_tag"
  | "set_priority"
  | "update";

export interface TestCasesBulkPayload {
  project_id: string;
  test_case_ids: string[];
  action: TestCaseBulkAction;
  suite_id?: string | null;
  status?: TestCaseDto["status"];
  owner_id?: string | null;
  tag?: string;
  priority?: TestCasePriority;
}

export interface TestCasesBulkResult {
  affected_count: number;
}

export type AttachmentTargetDto =
  | { type: "test_case"; test_case_id: string }
  | { type: "step"; step_id: string }
  | { type: "run_case"; run_case_id: string }
  | { type: "draft_step"; test_case_id: string; draft_step_client_id: string };

export interface AttachmentDto {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  target?: AttachmentTargetDto;
}

export interface TestStepDto {
  id: string;
  position: number;
  action: string;
  expected_result: string;
  client_id?: string | null;
}

export interface StatusBreakdownItemDto {
  status: RunCaseDto["status"];
  count: number;
}

export interface TestRunDto {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  environment_id: string | null;
  milestone_id: string | null;
  milestone_name: string | null;
  environment_revision_id: string | null;
  environment_revision_number: number | null;
  environment_name: string | null;
  environment_snapshot: Record<string, unknown>;
  build: string | null;
  assignee: string | null;
  /** Expected number of run items for this session (e.g. pytest --tms-stream); progress = items / planned. */
  planned_item_count?: number | null;
  status: "not_started" | "in_progress" | "completed" | "archived";
  created_by: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
  summary?: RunSummaryDto | null;
  status_breakdown?: { items: StatusBreakdownItemDto[] } | null;
  created_at: string;
  updated_at: string;
}

export interface JunitImportIssueDto {
  testcase_name: string;
  testcase_classname: string | null;
  automation_id: string | null;
  reason: string;
}

export interface JunitImportCreatedCaseDto {
  id: string | null;
  key: string | null;
  title: string;
  automation_id: string | null;
}

export interface JunitImportSummaryDto {
  total_cases: number;
  matched_by_automation_id: number;
  matched_by_name: number;
  created_test_cases: number;
  updated: number;
  unmatched: number;
  ambiguous: number;
  errors: number;
}

export interface JunitImportDto {
  id: string;
  test_run_id: string;
  target_run?: {
    id: string | null;
    name: string;
    match_mode: string;
  } | null;
  source_filename: string;
  source_content_type: string | null;
  dry_run: boolean;
  status: string;
  summary: JunitImportSummaryDto;
  created_cases: JunitImportCreatedCaseDto[];
  unmatched_cases: JunitImportIssueDto[];
  ambiguous_cases: JunitImportIssueDto[];
  error_cases: JunitImportIssueDto[];
  created_at: string;
}

export interface RunCaseDto {
  id: string;
  test_run_id: string;
  test_case_id: string;
  test_run_name?: string | null;
  test_run_status?: TestRunDto["status"] | null;
  test_run_environment_name?: string | null;
  test_run_environment_revision_number?: number | null;
  test_run_build?: string | null;
  assignee_id: string | null;
  status: "untested" | "in_progress" | "passed" | "error" | "failure" | "blocked" | "skipped" | "xfailed" | "xpassed";
  rows_total?: number;
  rows_passed?: number;
  rows_failed?: number;
  time: string | null;
  comment: string | null;
  defect_ids: string[];
  actual_result: string | null;
  system_out: string | null;
  system_err: string | null;
  executed_by_id: string | null;
  execution_count: number;
  last_executed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  test_case_key?: string | null;
  test_case_title?: string | null;
  test_case_priority?: TestCasePriority | null;
  test_case_tags?: string[];
  suite_name?: string | null;
  assignee_name?: string | null;
  external_issues?: ExternalIssueLinkDto[];
  created_at: string;
  updated_at: string;
  // legacy optional fields.
  dataset_id?: string | null;
  dataset_name?: string | null;
}

export interface RunCaseRowDto {
  id: string;
  run_case_id: string;
  parent_row_id: string | null;
  row_order: number;
  scenario_label: string;
  row_snapshot: Record<string, unknown>;
  status: RunCaseDto["status"];
  comment: string | null;
  defect_ids: string[];
  actual_result: string | null;
  system_out: string | null;
  system_err: string | null;
  executed_by_id: string | null;
  execution_count: number;
  last_executed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface RunCaseHistoryListDto {
  items: RunCaseHistoryDto[];
  page: number;
  page_size: number;
  has_next: boolean;
}

/** GET /run-cases/{id} response - RunCaseDto with embedded history */
export interface RunCaseDetailDto extends RunCaseDto {
  history: RunCaseHistoryListDto;
}

export interface RunSummaryDto {
  total: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  in_progress?: number;
  skipped: number;
  xfailed?: number;
  xpassed?: number;
  pass_rate: number;
}

export interface RunCaseHistoryDto {
  id: string;
  run_case_id: string;
  from_status: string | null;
  to_status: string;
  time: string | null;
  comment: string | null;
  defect_ids: string[];
  actual_result: string | null;
  system_out: string | null;
  system_err: string | null;
  executed_by_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  changed_by_id: string | null;
  changed_at: string;
}

export interface JiraConnectionDto {
  id: string;
  workspace_id: string;
  cloud_id: string;
  site_url: string;
  account_id: string;
  enabled: boolean;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
  last_sync_retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface JiraSystemSettingsDto {
  id: string;
  enabled: boolean;
  api_token_site_url: string;
  api_token_email: string;
  api_token_configured: boolean;
  api_base_url: string;
  http_timeout_seconds: number;
  http_max_retries: number;
  sync_default_interval_seconds: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface JiraProjectMappingDto {
  id: string;
  project_id: string;
  jira_connection_id: string;
  jira_project_key: string;
  default_issue_type_id: string | null;
  default_labels: string[];
  default_components: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JiraIssueResolveDto {
  key: string;
  url: string;
  summary: string | null;
  status: string | null;
  priority: string | null;
  assignee: string | null;
  assignee_account_id: string | null;
}

export interface JiraSyncRefreshDto {
  processed: number;
  updated: number;
  invalid: number;
  errors: number;
}

export type AuditActorType = "user" | "system";
export type AuditResult = "success" | "fail";

export interface AuditLogDto {
  event_id: string;
  timestamp_utc: string;
  actor_id: string | null;
  actor_type: AuditActorType;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  result: AuditResult;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  tenant_id: string | null;
  before: Record<string, unknown> | unknown[] | null;
  after: Record<string, unknown> | unknown[] | null;
  metadata: Record<string, unknown> | unknown[] | null;
}

export interface AuditLogsListDto {
  items: AuditLogDto[];
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface TestPlanDto {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  tags: string[];
  generation_source?: "manual" | "product_generated";
  generation_config?: PlanGenerationConfigDto | null;
  generation_summary?: Record<string, unknown>;
  milestone_id: string | null;
  milestone_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  suite_ids: string[];
  suite_names: string[];
  case_ids: string[];
  case_keys: string[];
}

export interface ProductDto {
  id: string;
  project_id: string;
  name: string;
  key: string;
  description: string | null;
  owner_id: string | null;
  status: ProductStatus;
  tags: string[];
  summary_snapshot?: {
    total_components: number;
    adequately_covered_components: number;
    uncovered_components: number;
    high_risk_uncovered_components: number;
    mandatory_release_cases: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentDto {
  id: string;
  project_id: string;
  name: string;
  key: string;
  description: string | null;
  owner_id: string | null;
  status: ProductStatus;
  tags: string[];
  business_criticality: number;
  change_frequency: number;
  integration_complexity: number;
  defect_density: number;
  production_incident_score: number;
  automation_confidence: number;
  risk_score: number;
  risk_level: ComponentRiskLevel;
  created_at: string;
  updated_at: string;
}

export interface ProductComponentLinkDto {
  id: string;
  product_id: string;
  component_id: string;
  is_core: boolean;
  sort_order: number;
}

export interface ComponentDependencyDto {
  id: string;
  source_component_id: string;
  target_component_id: string;
  dependency_type: "depends_on";
  created_at: string;
}

export interface ComponentGraphDto {
  components: ComponentDto[];
  dependencies: ComponentDependencyDto[];
}

export interface PlanGenerationConfigDto {
  product_ids: string[];
  component_ids: string[];
  include_dependent_components: boolean;
  minimum_risk_level: ComponentRiskLevel | null;
  generation_mode: PlanGenerationMode;
  explicit_include_case_ids: string[];
  explicit_exclude_case_ids: string[];
}

export interface PlanIncludedCaseDto {
  test_case_id: string;
  reason_codes: string[];
  matched_component_ids: string[];
  highest_component_risk_level: ComponentRiskLevel;
  highest_component_risk_score: number;
}

export interface PlanExcludedCaseDto {
  test_case_id: string;
  reason: string;
}

export interface PlanGenerationPreviewDto {
  resolved_component_ids: string[];
  resolved_case_ids: string[];
  included_cases: PlanIncludedCaseDto[];
  excluded_cases: PlanExcludedCaseDto[];
  summary: Record<string, number>;
}

export interface ProductSummaryDto {
  product_id: string;
  total_components: number;
  core_components: number;
  components_with_cases: number;
  adequately_covered_components: number;
  inadequately_covered_components: number;
  uncovered_components: number;
  high_risk_uncovered_components: number;
  coverage_score_total: number;
  required_coverage_score_total: number;
  total_cases: number;
  mandatory_release_cases: number;
  smoke_cases: number;
  regression_cases: number;
  deep_cases: number;
  manual_cases: number;
  automated_cases: number;
  per_component_breakdown: Array<{
    component_id: string;
    component_key: string;
    component_name: string;
    risk_level: ComponentRiskLevel;
    risk_score: number;
    coverage_score: number;
    required_coverage_score: number;
    adequately_covered: boolean;
    smoke_case_count: number;
    regression_case_count: number;
    deep_case_count: number;
    covered_case_ids: string[];
    uncovered: boolean;
  }>;
}

export type MilestoneStatus = "planned" | "active" | "completed" | "archived";

export interface MilestoneDto {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  owner_id: string | null;
  release_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneSummaryDto {
  milestone_id: string;
  plans_total: number;
  planned_cases_total: number;
  runs_total: number;
  planned_runs: number;
  active_runs: number;
  completed_runs: number;
  archived_runs: number;
  total_tests: number;
  untested: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  skipped: number;
  xfailed: number;
  xpassed: number;
  pass_rate: number;
  overdue: boolean;
}
