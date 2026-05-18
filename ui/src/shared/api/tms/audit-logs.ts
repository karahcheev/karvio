import { apiRequest } from "@/shared/api/client";
import type { AuditLogsListDto, AuditResult } from "./types";

export type AuditLogsSortBy = "timestamp_utc" | "actor" | "action" | "resource" | "result" | "request_id";

export type GetAuditLogsParams = {
  project_id?: string;
  date_from?: string;
  date_to?: string;
  actor_id?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  result?: AuditResult;
  page?: number;
  page_size?: number;
  sort_by?: AuditLogsSortBy;
  sort_order?: "asc" | "desc";
};

export async function getAuditLogs(params?: GetAuditLogsParams): Promise<AuditLogsListDto> {
  const query = new URLSearchParams();

  if (params?.project_id) query.set("project_id", params.project_id);
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  if (params?.actor_id) query.set("actor_id", params.actor_id);
  if (params?.action) query.set("action", params.action);
  if (params?.resource_type) query.set("resource_type", params.resource_type);
  if (params?.resource_id) query.set("resource_id", params.resource_id);
  if (params?.result) query.set("result", params.result);
  if (typeof params?.page === "number") query.set("page", String(params.page));
  if (typeof params?.page_size === "number") query.set("page_size", String(params.page_size));
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_order) query.set("sort_order", params.sort_order);

  const suffix = query.toString();
  return apiRequest<AuditLogsListDto>(suffix ? `/audit-logs?${suffix}` : "/audit-logs");
}
