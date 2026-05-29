import { apiFetch, apiRequest } from "@/shared/api/client";
import { downloadResponseAsFile } from "./helpers";
import {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "./attachments";
import type {
  AttachmentDto,
  ComponentRiskLevel,
  CoverageStrength,
  CoverageType,
  TestCaseDto,
  TestCasePriority,
  TestCaseTemplateType,
  TestCasesBulkPayload,
  TestCasesBulkResult,
  TestStepDto,
} from "./types";

export type TestCasesSortBy =
  | "created_at"
  | "updated_at"
  | "key"
  | "title"
  | "status"
  | "priority"
  | "owner_name"
  | "suite_name";

export async function getTestCases(
  projectId: string,
  params?: { sortBy?: TestCasesSortBy; sortDirection?: "asc" | "desc" }
): Promise<TestCaseDto[]> {
  const items: TestCaseDto[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = await getTestCasesPage({
      projectId,
      page,
      pageSize: 200,
      statuses: ["active", "draft"],
      sortBy: params?.sortBy,
      sortOrder: params?.sortDirection,
    });
    items.push(...result.items);
    hasNext = result.has_next;
    page += 1;
  }
  return items;
}

export type TestCasesPageResponse = {
  items: TestCaseDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  /** Total rows for current filters (same on every page). Omitted by older servers. */
  total?: number;
};

export async function getTestCasesPage(params: {
  projectId: string;
  page?: number;
  pageSize?: number;
  suiteIds?: string[];
  excludeTestCaseIds?: string[];
  statuses?: TestCaseDto["status"][];
  priorities?: string[];
  productIds?: string[];
  componentIds?: string[];
  minimumComponentRiskLevel?: ComponentRiskLevel;
  tags?: string[];
  ownerId?: string;
  testCaseTypes?: string[];
  /** Search by title, key, or tags. Case-insensitive partial match. */
  search?: string;
  sortBy?: TestCasesSortBy;
  sortOrder?: "asc" | "desc";
}): Promise<TestCasesPageResponse> {
  const query = new URLSearchParams({
    project_id: params.projectId,
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 25),
  });
  params.suiteIds?.forEach((suiteId) => {
    if (suiteId) query.append("suite_id", suiteId);
  });
  params.excludeTestCaseIds?.forEach((id) => {
    if (id) query.append("exclude_test_case_id", id);
  });
  params.statuses?.forEach((status) => {
    if (status) query.append("status", status);
  });
  params.priorities?.forEach((priority) => {
    if (priority) query.append("priority", priority);
  });
  params.productIds?.forEach((productId) => {
    if (productId) query.append("product_id", productId);
  });
  params.componentIds?.forEach((componentId) => {
    if (componentId) query.append("component_id", componentId);
  });
  if (params.minimumComponentRiskLevel) query.set("minimum_component_risk_level", params.minimumComponentRiskLevel);
  params.tags?.forEach((tag) => {
    if (tag) query.append("tag", tag);
  });
  if (params.ownerId) query.set("owner_id", params.ownerId);
  params.testCaseTypes?.forEach((type) => {
    if (type) query.append("test_case_type", type);
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sortBy) query.set("sort_by", params.sortBy);
  if (params.sortOrder) query.set("sort_order", params.sortOrder);
  return apiRequest<TestCasesPageResponse>(`/test-cases?${query.toString()}`);
}

export async function getTestCaseTags(projectId: string): Promise<string[]> {
  const query = new URLSearchParams({ project_id: projectId });
  const result = await apiRequest<{ items: string[] }>(`/test-cases/tags?${query.toString()}`);
  return result.items;
}

export type TestCaseExportFormat =
  | "csv"
  | "testlink_xml"
  | "xray_json"
  | "native_json"
  | "junit_xml";

export const TEST_CASE_EXPORT_FORMATS: ReadonlyArray<{
  value: TestCaseExportFormat;
  label: string;
}> = [
  { value: "csv", label: "CSV (TestRail / Zephyr / qTest)" },
  { value: "testlink_xml", label: "TestLink XML" },
  { value: "xray_json", label: "Xray / Zephyr JSON" },
  { value: "junit_xml", label: "JUnit XML" },
  { value: "native_json", label: "JSON" },
];

const EXPORT_FORMAT_EXTENSION: Record<TestCaseExportFormat, string> = {
  csv: "csv",
  testlink_xml: "xml",
  xray_json: "json",
  native_json: "json",
  junit_xml: "xml",
};

export async function downloadTestCaseExport(
  testCaseId: string,
  format: TestCaseExportFormat,
): Promise<void> {
  const response = await apiFetch(
    `/test-cases/${encodeURIComponent(testCaseId)}/export?format=${format}`,
  );
  await downloadResponseAsFile(response, `${testCaseId}.${EXPORT_FORMAT_EXTENSION[format]}`);
}

export type TestCasesExportFilters = {
  suiteIds?: string[];
  statuses?: string[];
  priorities?: string[];
  tags?: string[];
  ownerId?: string;
  testCaseTypes?: string[];
  productIds?: string[];
  componentIds?: string[];
  search?: string;
};

export async function downloadTestCasesExport(
  projectId: string,
  format: TestCaseExportFormat,
  opts: { testCaseIds?: string[]; filters?: TestCasesExportFilters },
): Promise<void> {
  const query = new URLSearchParams({ project_id: projectId, format });
  if (opts.testCaseIds?.length) {
    for (const id of opts.testCaseIds) {
      if (id) query.append("test_case_id", id);
    }
  } else if (opts.filters) {
    const filters = opts.filters;
    filters.suiteIds?.forEach((suiteId) => suiteId && query.append("suite_id", suiteId));
    filters.statuses?.forEach((status) => status && query.append("status", status));
    filters.priorities?.forEach((priority) => priority && query.append("priority", priority));
    filters.tags?.forEach((tag) => tag && query.append("tag", tag));
    if (filters.ownerId) query.set("owner_id", filters.ownerId);
    filters.testCaseTypes?.forEach((type) => type && query.append("test_case_type", type));
    filters.productIds?.forEach((productId) => productId && query.append("product_id", productId));
    filters.componentIds?.forEach((componentId) => componentId && query.append("component_id", componentId));
    if (filters.search?.trim()) query.set("search", filters.search.trim());
  }
  const response = await apiFetch(`/test-cases/export?${query.toString()}`);
  await downloadResponseAsFile(
    response,
    `test-cases-${projectId}.${EXPORT_FORMAT_EXTENSION[format]}`,
  );
}

export async function getTestCase(testCaseId: string): Promise<TestCaseDto> {
  return apiRequest<TestCaseDto>(`/test-cases/${testCaseId}`);
}

export type PatchTestCasePayload = Partial<Omit<TestCaseDto, "component_coverages">> & {
  component_coverages?: Array<{
    component_id: string;
    coverage_type: CoverageType;
    coverage_strength: CoverageStrength;
    is_mandatory_for_release?: boolean;
    notes?: string | null;
  }>;
};

export async function patchTestCase(testCaseId: string, payload: PatchTestCasePayload): Promise<TestCaseDto> {
  return apiRequest<TestCaseDto>(`/test-cases/${testCaseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createTestCase(payload: {
  project_id: string;
  suite_id: string | null;
  owner_id?: string | null;
  primary_product_id?: string | null;
  automation_id?: string | null;
  title: string;
  preconditions?: string | null;
  template_type?: TestCaseTemplateType;
  steps_text?: string | null;
  expected?: string | null;
  raw_test?: string | null;
  raw_test_language?: string | null;
  time?: string | null;
  priority?: TestCasePriority | null;
  test_case_type?: "manual" | "automated" | null;
  tags: string[];
  component_coverages?: Array<{
    component_id: string;
    coverage_type: CoverageType;
    coverage_strength: CoverageStrength;
    is_mandatory_for_release?: boolean;
    notes?: string | null;
  }>;
  status?: "draft" | "active" | "archived";
}): Promise<TestCaseDto> {
  return apiRequest<TestCaseDto>("/test-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTestCase(testCaseId: string): Promise<void> {
  await apiRequest<void>(`/test-cases/${testCaseId}`, {
    method: "DELETE",
  });
}

export async function bulkOperateTestCases(payload: TestCasesBulkPayload): Promise<TestCasesBulkResult> {
  return apiRequest<TestCasesBulkResult>("/test-cases/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type TestCaseStepsResponse = {
  test_case_id: string;
  steps: TestStepDto[];
  step_attachments: Record<string, AttachmentDto[]>;
};

export async function getTestCaseSteps(testCaseId: string): Promise<TestCaseStepsResponse> {
  return apiRequest<TestCaseStepsResponse>(`/test-cases/${testCaseId}/steps`);
}

export async function replaceTestCaseSteps(
  testCaseId: string,
  steps: Array<{ position: number; action: string; expected_result: string; client_id?: string | null }>
): Promise<TestCaseStepsResponse> {
  return apiRequest<TestCaseStepsResponse>(`/test-cases/${testCaseId}/steps`, {
    method: "PUT",
    body: JSON.stringify({ steps }),
  });
}

export async function getTestCaseAttachments(testCaseId: string): Promise<AttachmentDto[]> {
  return listAttachments({ test_case_id: testCaseId });
}

export async function uploadTestCaseAttachment(testCaseId: string, file: File): Promise<AttachmentDto> {
  return uploadAttachment({ test_case_id: testCaseId }, file);
}

export async function deleteTestCaseAttachment(_testCaseId: string, attachmentId: string): Promise<void> {
  return deleteAttachment(attachmentId);
}

export async function getStepAttachments(_testCaseId: string, stepId: string): Promise<AttachmentDto[]> {
  return listAttachments({ step_id: stepId });
}

export async function uploadStepAttachment(_testCaseId: string, stepId: string, file: File): Promise<AttachmentDto> {
  return uploadAttachment({ step_id: stepId }, file);
}

export async function uploadDraftStepAttachment(
  testCaseId: string,
  draftStepId: string,
  file: File
): Promise<AttachmentDto> {
  return uploadAttachment(
    { test_case_id: testCaseId, draft_step_client_id: draftStepId },
    file
  );
}

export async function deleteStepAttachment(_testCaseId: string, _stepId: string, attachmentId: string): Promise<void> {
  return deleteAttachment(attachmentId);
}

export async function downloadTestCaseAttachment(
  _testCaseId: string,
  attachmentId: string,
  filename: string
): Promise<void> {
  return downloadAttachment(attachmentId, filename);
}

export async function downloadStepAttachment(
  _testCaseId: string,
  _stepId: string,
  attachmentId: string,
  filename: string
): Promise<void> {
  return downloadAttachment(attachmentId, filename);
}
