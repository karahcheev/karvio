import type { AuditLogDto, AuditResult } from "@/shared/api";

export type AuditColumn = "timestamp" | "actor" | "action" | "resource" | "result" | "request_id";

export type AuditTableRow = AuditLogDto & { actorLabel: string };

export type AuditFilters = {
  result: "all" | AuditResult;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
};

export type AuditChangeItem = {
  path: string;
  before: unknown;
  after: unknown;
};
