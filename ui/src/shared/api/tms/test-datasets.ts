import { apiRequest } from "@/shared/api/client";
import type {
  DatasetRevisionDto,
  TestCaseDatasetBindingDto,
  TestDatasetDto,
  TestDatasetsBulkPayload,
  TestDatasetsBulkResult,
} from "./types";

function buildDatasetsParams(filters?: {
  projectId?: string;
  testCaseId?: string;
  excludeTestCaseId?: string;
  sourceTypes?: TestDatasetDto["source_type"][];
  page?: number;
  pageSize?: number;
  search?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set("project_id", filters.projectId);
  if (filters?.testCaseId) params.set("test_case_id", filters.testCaseId);
  if (filters?.excludeTestCaseId) params.set("exclude_test_case_id", filters.excludeTestCaseId);
  filters?.sourceTypes?.forEach((t) => {
    if (t) params.append("source_type", t);
  });
  if (typeof filters?.page === "number") params.set("page", String(filters.page));
  if (typeof filters?.pageSize === "number") params.set("page_size", String(filters.pageSize));
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  return params;
}

export type TestDatasetsPageResponse = {
  items: TestDatasetDto[];
  page: number;
  page_size: number;
  has_next: boolean;
  total?: number;
};

export async function getTestDatasetsPage(params: {
  projectId: string;
  testCaseId?: string;
  excludeTestCaseId?: string;
  sourceTypes?: TestDatasetDto["source_type"][];
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<TestDatasetsPageResponse> {
  const query = buildDatasetsParams(params);
  return apiRequest<TestDatasetsPageResponse>(`/datasets?${query.toString()}`);
}

export async function getTestDataset(datasetId: string): Promise<TestDatasetDto> {
  return apiRequest(`/datasets/${datasetId}`);
}

export async function getDatasetRevisions(
  datasetId: string,
  params?: { page?: number; pageSize?: number }
): Promise<{ items: DatasetRevisionDto[]; page: number; page_size: number; has_next: boolean; total: number }> {
  const query = new URLSearchParams();
  if (typeof params?.page === "number") query.set("page", String(params.page));
  if (typeof params?.pageSize === "number") query.set("page_size", String(params.pageSize));
  const suffix = query.toString();
  const queryPart = suffix ? `?${suffix}` : "";
  return apiRequest(`/datasets/${datasetId}/revisions${queryPart}`);
}

export async function getDatasetRevision(datasetId: string, revisionNumber: number): Promise<DatasetRevisionDto> {
  return apiRequest(`/datasets/${datasetId}/revisions/${revisionNumber}`);
}

export async function createTestDataset(payload: {
  project_id: string;
  name: string;
  description?: string | null;
  source_type?: TestDatasetDto["source_type"];
  source_ref?: string | null;
  columns: Array<{
    column_key: string;
    display_name: string;
    data_type?: string;
    required?: boolean;
    default_value?: string | null;
    is_scenario_label?: boolean;
  }>;
  rows: Array<{
    row_key: string;
    scenario_label?: string | null;
    values: Record<string, unknown>;
    is_active?: boolean;
  }>;
  change_summary?: string | null;
}): Promise<TestDatasetDto> {
  return apiRequest("/datasets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchTestDataset(
  datasetId: string,
  payload: Partial<{
    name: string;
    description: string | null;
    source_type: TestDatasetDto["source_type"];
    source_ref: string | null;
    status: TestDatasetDto["status"];
    columns: Array<{
      column_key: string;
      display_name: string;
      data_type?: string;
      required?: boolean;
      default_value?: string | null;
      is_scenario_label?: boolean;
    }>;
    rows: Array<{
      row_key: string;
      scenario_label?: string | null;
      values: Record<string, unknown>;
      is_active?: boolean;
    }>;
    change_summary: string | null;
  }>
): Promise<TestDatasetDto> {
  return apiRequest(`/datasets/${datasetId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTestDataset(datasetId: string): Promise<void> {
  await apiRequest(`/datasets/${datasetId}`, {
    method: "DELETE",
  });
}

export async function bulkOperateTestDatasets(payload: TestDatasetsBulkPayload): Promise<TestDatasetsBulkResult> {
  return apiRequest<TestDatasetsBulkResult>("/datasets/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTestCaseDatasetBindings(testCaseId: string): Promise<{ items: TestCaseDatasetBindingDto[] }> {
  return apiRequest(`/test-cases/${testCaseId}/dataset-bindings`);
}

export async function bindDatasetToTestCase(
  testCaseId: string,
  payload: {
    dataset_id: string;
    dataset_alias: string;
    mode?: "follow_latest" | "pin_revision";
    pinned_revision_number?: number | null;
    row_selection_type?: "all" | "subset";
    selected_row_keys?: string[];
    sort_order?: number;
  }
): Promise<TestCaseDatasetBindingDto> {
  return apiRequest(`/test-cases/${testCaseId}/dataset-bindings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchDatasetBinding(
  testCaseId: string,
  bindingId: string,
  payload: Partial<{
    dataset_alias: string;
    mode: "follow_latest" | "pin_revision";
    pinned_revision_number: number | null;
    row_selection_type: "all" | "subset";
    selected_row_keys: string[];
    sort_order: number;
  }>
): Promise<TestCaseDatasetBindingDto> {
  return apiRequest(`/test-cases/${testCaseId}/dataset-bindings/${bindingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function unbindDatasetFromTestCase(testCaseId: string, bindingId: string): Promise<void> {
  await apiRequest(`/test-cases/${testCaseId}/dataset-bindings/${bindingId}`, {
    method: "DELETE",
  });
}
