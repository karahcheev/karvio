import type { TestCaseBulkAction } from "@/shared/api";

export const MAX_SUITE_DEPTH = 4;
export const EXPANDED_SUITES_PARAM = "expandedSuites";
export const SELECTED_SUITE_PARAM = "selectedSuite";
export const SUITES_COLLAPSED_PARAM = "suitesCollapsed";
export const SUITES_COLLAPSED_STORAGE_KEY = "tms:test-cases:suitesCollapsed";

export const BULK_ACTION_LABELS: Record<TestCaseBulkAction, string> = {
  delete: "deleted",
  move: "moved",
  set_status: "updated status",
  set_owner: "updated owner",
  add_tag: "tagged",
  set_priority: "updated priority",
  update: "updated",
};

export const TEST_CASE_ATTACHMENT_LIMIT_BYTES = 50 * 1024 * 1024;
export const STEP_ATTACHMENT_LIMIT_BYTES = 10 * 1024 * 1024;
