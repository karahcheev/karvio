import type { CreateTestRunPayload } from "@/modules/test-runs/components/CreateTestRunModal";
import { uniqueIds } from "./mappers";

export function normalizeCreateRunPayload(payload: CreateTestRunPayload) {
  const environmentId = payload.environment_id?.trim();
  const milestoneId = payload.milestone_id?.trim();
  return {
    name: payload.name.trim(),
    description: payload.description.trim() || null,
    environment_id: environmentId || undefined,
    milestone_id: milestoneId || null,
    build: payload.build.trim() || null,
    assignee: payload.assignee,
    selectedSuiteIds: uniqueIds(payload.selectedSuiteIds ?? []),
    selectedCaseIds: uniqueIds(payload.selectedCaseIds),
  };
}
