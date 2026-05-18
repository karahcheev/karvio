import type { AuditLogsSortBy } from "@/shared/api";
import type { AuditColumn } from "@/modules/audit-logs/utils/types";

export function mapAuditSorting(column: AuditColumn): AuditLogsSortBy {
  switch (column) {
    case "timestamp":
      return "timestamp_utc";
    case "actor":
      return "actor";
    case "action":
      return "action";
    case "resource":
      return "resource";
    case "result":
      return "result";
    case "request_id":
      return "request_id";
  }
}
