import type { RunCaseDto, TestRunDto } from "@/shared/api";

export const RUN_ITEM_STATUS_OPTIONS: Array<{ value: RunCaseDto["status"]; label: string }> = [
  { value: "untested", label: "Untested" },
  { value: "in_progress", label: "In Progress" },
  { value: "passed", label: "Passed" },
  { value: "error", label: "Error" },
  { value: "failure", label: "Failure" },
  { value: "blocked", label: "Blocked" },
  { value: "skipped", label: "Skipped" },
  { value: "xfailed", label: "XFailed" },
  { value: "xpassed", label: "XPassed" },
];

export const EMPTY_STATUS_BREAKDOWN: Record<RunCaseDto["status"], number> = {
  untested: 0,
  in_progress: 0,
  passed: 0,
  error: 0,
  failure: 0,
  blocked: 0,
  skipped: 0,
  xfailed: 0,
  xpassed: 0,
};

export function getRunItemStatusTone(status: RunCaseDto["status"]) {
  if (status === "passed") return "success";
  if (status === "error") return "error";
  if (status === "failure" || status === "xpassed") return "danger";
  if (status === "blocked") return "warning";
  if (status === "in_progress") return "info";
  if (status === "skipped") return "neutral";
  if (status === "xfailed") return "neutral";
  return "muted";
}

export function formatRunItemStatusLabel(status: RunCaseDto["status"]) {
  if (status === "in_progress") return "in progress";
  if (status === "xfailed") return "XFailed";
  if (status === "xpassed") return "XPassed";
  return status.replace("_", " ");
}

export function getRunStatusTone(status: TestRunDto["status"]) {
  if (status === "in_progress") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

export function getRunStatusText(status: TestRunDto["status"]) {
  if (status === "in_progress") return "In Progress";
  if (status === "not_started") return "Not Started";
  if (status === "completed") return "Completed";
  return "Archived";
}

export function canImportJunitIntoRun(status: TestRunDto["status"]) {
  return status === "not_started" || status === "in_progress";
}
