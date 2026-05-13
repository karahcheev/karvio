import { apiRequest } from "@/shared/api/client";
import type {
  ExternalIssueLinkDto,
  ExternalIssueOwnerType,
  JiraConnectionDto,
  JiraIssueResolveDto,
  JiraProjectMappingDto,
  JiraSystemSettingsDto,
  JiraSyncRefreshDto,
} from "./types";

export async function connectJiraViaApiToken(): Promise<{ connected: boolean; connection: JiraConnectionDto }> {
  return apiRequest("/integrations/jira/connect/api-token", {
    method: "POST",
  });
}

export async function getJiraSystemSettings(): Promise<JiraSystemSettingsDto> {
  return apiRequest<JiraSystemSettingsDto>("/integrations/jira/settings");
}

export async function upsertJiraSystemSettings(payload: {
  enabled: boolean;
  api_token_site_url: string;
  api_token_email: string;
  api_token?: string | null;
  api_base_url: string;
  http_timeout_seconds: number;
  http_max_retries: number;
  sync_default_interval_seconds: number;
}): Promise<JiraSystemSettingsDto> {
  return apiRequest<JiraSystemSettingsDto>("/integrations/jira/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getJiraConnections(): Promise<JiraConnectionDto[]> {
  const result = await apiRequest<{ items: JiraConnectionDto[] }>("/integrations/jira/connections");
  return result.items;
}

export async function deleteJiraConnection(connectionId: string): Promise<void> {
  await apiRequest(`/integrations/jira/connections/${connectionId}`, {
    method: "DELETE",
  });
}

export async function patchJiraConnection(
  connectionId: string,
  payload: {
    enabled?: boolean;
  },
): Promise<JiraConnectionDto> {
  return apiRequest(`/integrations/jira/connections/${connectionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getJiraMappings(projectId?: string): Promise<JiraProjectMappingDto[]> {
  const query = new URLSearchParams();
  if (projectId) query.set("project_id", projectId);
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : "";
  const result = await apiRequest<{ items: JiraProjectMappingDto[] }>(`/integrations/jira/mappings${suffix}`);
  return result.items;
}

export async function createJiraMapping(payload: {
  project_id: string;
  jira_connection_id?: string;
  jira_project_key: string;
  default_issue_type_id?: string | null;
  default_labels?: string[];
  default_components?: string[];
  active?: boolean;
}): Promise<JiraProjectMappingDto> {
  return apiRequest("/integrations/jira/mappings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchJiraMapping(
  mappingId: string,
  payload: {
    jira_project_key?: string;
    default_issue_type_id?: string | null;
    default_labels?: string[];
    default_components?: string[];
    active?: boolean;
  },
): Promise<JiraProjectMappingDto> {
  return apiRequest(`/integrations/jira/mappings/${mappingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteJiraMapping(mappingId: string): Promise<void> {
  await apiRequest(`/integrations/jira/mappings/${mappingId}`, {
    method: "DELETE",
  });
}

export async function resolveJiraIssue(payload: {
  key: string;
  projectId?: string;
}): Promise<JiraIssueResolveDto> {
  const query = new URLSearchParams({ key: payload.key });
  if (payload.projectId) query.set("project_id", payload.projectId);
  return apiRequest(`/integrations/jira/issues/resolve?${query.toString()}`);
}

export async function listExternalIssueLinks(payload: {
  ownerType: ExternalIssueOwnerType;
  ownerId: string;
}): Promise<ExternalIssueLinkDto[]> {
  const query = new URLSearchParams({
    owner_type: payload.ownerType,
    owner_id: payload.ownerId,
  });
  const result = await apiRequest<{ items: ExternalIssueLinkDto[] }>(
    `/integrations/jira/issues/links?${query.toString()}`,
  );
  return result.items;
}

export async function linkJiraIssue(payload: {
  owner_type: ExternalIssueOwnerType;
  owner_id: string;
  issue_key_or_url: string;
}): Promise<ExternalIssueLinkDto> {
  return apiRequest("/integrations/jira/issues/link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createJiraIssueFromRunCase(payload: {
  run_case_id: string;
  summary?: string;
  description?: string;
  issue_type_id?: string;
  labels?: string[];
  components?: string[];
  idempotency_key?: string;
}): Promise<ExternalIssueLinkDto> {
  return apiRequest("/integrations/jira/issues/create-from-run-case", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createJiraIssueFromRunCases(payload: {
  run_case_ids: string[];
  summary?: string;
  description?: string;
  issue_type_id?: string;
  labels?: string[];
  components?: string[];
  idempotency_key?: string;
}): Promise<{ items: ExternalIssueLinkDto[] }> {
  return apiRequest("/integrations/jira/issues/create-from-run-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function linkJiraIssueToRunCases(payload: {
  run_case_ids: string[];
  issue_key_or_url: string;
}): Promise<{ items: ExternalIssueLinkDto[] }> {
  return apiRequest("/integrations/jira/issues/link-run-cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unlinkJiraIssue(linkId: string): Promise<void> {
  await apiRequest(`/integrations/jira/issues/link/${linkId}`, {
    method: "DELETE",
  });
}

export async function refreshJiraSync(projectId?: string): Promise<JiraSyncRefreshDto> {
  return apiRequest("/integrations/jira/sync/refresh", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId }),
  });
}
