import { formatRelativeTime } from "@/shared/api";
import type { TestCaseDto } from "@/shared/api";
import type { TestCaseColumn, TestCaseListItem } from "../utils/types";

export function mapTestCaseToListItem(item: TestCaseDto, suiteNamesById: Map<string, string>): TestCaseListItem {
  return {
    id: item.key,
    testCaseId: item.id,
    suiteId: item.suite_id,
    ownerId: item.owner_id,
    title: item.title,
    time: item.time ?? null,
    status: item.status,
    priority: item.priority ?? "medium",
    testCaseType: item.test_case_type ?? "manual",
    owner: item.owner_name ?? (item.owner_id ? "Unknown user" : "Unassigned"),
    suite: item.suite_name ?? (item.suite_id ? suiteNamesById.get(item.suite_id) ?? item.suite_id : "Unsorted"),
    tags: item.tags,
    lastRun: formatRelativeTime(item.updated_at),
    lastStatus: null,
  };
}

export function mapTestCaseSorting(
  column: TestCaseColumn,
): "title" | "status" | "priority" | "suite_name" | "owner_name" | "updated_at" | null {
  switch (column) {
    case "title":
      return "title";
    case "status":
      return "status";
    case "priority":
      return "priority";
    case "suite":
      return "suite_name";
    case "owner":
      return "owner_name";
    case "lastRun":
      return "updated_at";
    case "id":
    case "tags":
    case "type":
      return null;
  }
}
