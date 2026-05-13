import { apiRequest } from "@/shared/api/client";
import type { CoverageStrength, CoverageType, TestCasePriority, TestCaseType } from "./types";

export type AiFeatureStatusDto = {
  enabled: boolean;
  provider: string | null;
  model: string | null;
};

export type ProjectAiSettingsDto = {
  id: string;
  project_id: string;
  enabled: boolean;
  provider: "openai" | null;
  model: string | null;
  api_key_configured: boolean;
  timeout_ms: number;
  http_max_retries: number;
  duplicate_high_threshold: number;
  duplicate_medium_threshold: number;
  created_at: string;
  updated_at: string;
};

export type AiEffectiveSource = "project" | "global" | "env";

export type ProjectAiSettingsOverviewItemDto = {
  project_id: string;
  project_name: string;
  has_project_settings: boolean;
  enabled: boolean;
  provider: string | null;
  model: string | null;
  api_key_configured: boolean;
  effective_source: AiEffectiveSource;
};

export type GlobalAiSettingsDto = {
  enabled: boolean;
  provider: "openai" | null;
  model: string | null;
  api_key_configured: boolean;
  timeout_ms: number;
  http_max_retries: number;
  duplicate_high_threshold: number;
  duplicate_medium_threshold: number;
  created_at: string;
  updated_at: string;
};

export type GlobalAiSettingsPayload = {
  enabled: boolean;
  provider: "openai" | null;
  model: string | null;
  api_key?: string | null;
  timeout_ms: number;
  http_max_retries: number;
  duplicate_high_threshold: number;
  duplicate_medium_threshold: number;
};

export type ProjectAiSettingsOverviewListDto = {
  items: ProjectAiSettingsOverviewItemDto[];
};

export type ProjectAiSettingsPayload = {
  project_id: string;
  enabled: boolean;
  provider: "openai" | null;
  model: string | null;
  api_key?: string | null;
  timeout_ms: number;
  http_max_retries: number;
  duplicate_high_threshold: number;
  duplicate_medium_threshold: number;
};

export type AiStepDraftDto = {
  action: string;
  expected_result: string;
};

export type AiCoverageDraftDto = {
  component_id: string;
  coverage_type: CoverageType;
  coverage_strength: CoverageStrength;
  is_mandatory_for_release: boolean;
  notes: string | null;
};

export type AiDuplicateCandidateDto = {
  candidate_test_case_id: string;
  key: string;
  title: string;
  similarity_score: number;
  reason: string;
  matching_fields: string[];
  recommendation: "merge" | "keep_both" | "review";
};

export type AiDraftTestCaseDto = {
  title: string;
  preconditions: string | null;
  steps: AiStepDraftDto[];
  priority: TestCasePriority;
  test_case_type: TestCaseType;
  tags: string[];
  primary_product_id: string | null;
  component_coverages: AiCoverageDraftDto[];
  risk_reason: string | null;
  suggestion_reason: string;
  ai_confidence: number;
  possible_duplicates: AiDuplicateCandidateDto[];
};

export type GenerateAiTestCasesPayload = {
  project_id: string;
  source_text: string | null;
  suite_id: string | null;
  primary_product_id: string | null;
  component_ids: string[];
  test_focus: Array<"functional" | "regression" | "negative" | "boundary" | "security" | "accessibility" | "api" | "ui">;
  priority_preference: TestCasePriority | null;
  count: number;
};

export type GenerateAiTestCasesResponseDto = {
  draft_test_cases: AiDraftTestCaseDto[];
  source_references: string[];
  warnings: string[];
};

export type ReviewAiTestCasePayload = {
  mode: "quality" | "completeness" | "clarity" | "edge_cases" | "automation_readiness" | "all";
};

export type ReviewAiTestCaseResponseDto = {
  quality_score: number;
  summary: string;
  issues: Array<{
    severity: "low" | "medium" | "high";
    field: "title" | "preconditions" | "steps" | "expected_result" | "priority" | "tags" | "coverage" | "automation" | "other";
    problem: string;
    recommendation: string;
  }>;
  suggested_revision: {
    title: string | null;
    preconditions: string | null;
    steps: AiStepDraftDto[] | null;
    priority: TestCasePriority | null;
    tags: string[] | null;
    component_coverages: AiCoverageDraftDto[] | null;
  };
  missing_edge_cases: string[];
  automation_readiness: {
    score: number;
    blocking_issues: string[];
    recommendations: string[];
  };
};

export type CheckAiDuplicatesPayload = {
  project_id: string;
  test_case: {
    title: string;
    preconditions: string | null;
    steps: AiStepDraftDto[];
    tags: string[];
    component_ids: string[];
  };
  exclude_test_case_id: string | null;
};

export type CheckAiDuplicatesResponseDto = {
  duplicates: AiDuplicateCandidateDto[];
  warnings: string[];
};

export async function getAiTestCaseStatus(projectId?: string): Promise<AiFeatureStatusDto> {
  const query = projectId ? `?${new URLSearchParams({ project_id: projectId }).toString()}` : "";
  return apiRequest<AiFeatureStatusDto>(`/ai/test-cases/status${query}`);
}

export async function getAiSettingsOverview(): Promise<ProjectAiSettingsOverviewListDto> {
  return apiRequest<ProjectAiSettingsOverviewListDto>("/settings/ai");
}

export async function getProjectAiSettings(projectId: string): Promise<ProjectAiSettingsDto> {
  return apiRequest<ProjectAiSettingsDto>(`/settings/ai/${projectId}`);
}

export async function updateProjectAiSettings(payload: ProjectAiSettingsPayload): Promise<ProjectAiSettingsDto> {
  return apiRequest<ProjectAiSettingsDto>("/settings/ai", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function generateAiTestCases(
  payload: GenerateAiTestCasesPayload
): Promise<GenerateAiTestCasesResponseDto> {
  return apiRequest<GenerateAiTestCasesResponseDto>("/ai/test-cases/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reviewAiTestCase(
  testCaseId: string,
  payload: ReviewAiTestCasePayload
): Promise<ReviewAiTestCaseResponseDto> {
  return apiRequest<ReviewAiTestCaseResponseDto>(`/ai/test-cases/${testCaseId}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkAiDuplicates(payload: CheckAiDuplicatesPayload): Promise<CheckAiDuplicatesResponseDto> {
  return apiRequest<CheckAiDuplicatesResponseDto>("/ai/test-cases/duplicates/check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectAiSettings(projectId: string): Promise<void> {
  await apiRequest<void>(`/settings/ai/${projectId}`, { method: "DELETE" });
}

export async function getGlobalAiSettings(): Promise<GlobalAiSettingsDto> {
  return apiRequest<GlobalAiSettingsDto>("/settings/ai/global");
}

export async function updateGlobalAiSettings(payload: GlobalAiSettingsPayload): Promise<GlobalAiSettingsDto> {
  return apiRequest<GlobalAiSettingsDto>("/settings/ai/global", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
