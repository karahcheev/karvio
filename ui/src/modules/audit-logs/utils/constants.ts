import type { AuditFilters } from "./types";

export const IGNORED_CHANGE_FIELDS = new Set(["updated_at", "last_executed_at"]);

export const WRITE_ACTION_HINTS = [
  "create",
  "update",
  "set_",
  "change_",
  "replace",
  "start",
  "complete",
  "archive",
  "reset_password",
  "bulk_add",
  "bulk_update",
];

export const DEFAULT_FILTERS: AuditFilters = {
  result: "all",
  actorId: "",
  action: "",
  resourceType: "",
  resourceId: "",
};
