import { useMemo } from "react";
import { getAvailableStatusOptions } from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { ProjectRole } from "@/modules/test-cases/utils/testCaseEditorTypes";

export function useTestCasePermissions(
  currentProjectRole: ProjectRole,
  persistedStatus: "draft" | "active" | "archived"
) {
  const allowAnyStatusTransition = currentProjectRole === "manager";
  const availableStatusOptions = useMemo(
    () => getAvailableStatusOptions(persistedStatus, allowAnyStatusTransition),
    [allowAnyStatusTransition, persistedStatus]
  );
  return { allowAnyStatusTransition, availableStatusOptions };
}
