import { apiFetch } from "@/shared/api/client";
import type { TestCaseComponentCoverageDto, TestStepDto } from "@/shared/api";
import type { EditableCoverage, EditableStep, EditorSnapshot } from "./testCaseEditorTypes";

const INTERNAL_ATTACHMENT_IMAGE_PATTERN = /!\[([^\]]*)\]\(\/attachments\/[^)\s]+\)/g;

export async function fetchAttachmentAsFile(
  path: string,
  filename: string,
  contentType: string
): Promise<File> {
  const response = await apiFetch(path);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || contentType || "application/octet-stream",
  });
}

export function createLocalStep(): EditableStep {
  return {
    id: `local-${crypto.randomUUID()}`,
    action: "",
    expectedResult: "",
    persisted: false,
  };
}

export function createLocalCoverage(): EditableCoverage {
  return {
    id: `local-${crypto.randomUUID()}`,
    componentId: "",
    coverageType: "direct",
    coverageStrength: "smoke",
    isMandatoryForRelease: false,
    persisted: false,
  };
}

export function stripInternalAttachmentImageSources(value: string): string {
  return value.replace(INTERNAL_ATTACHMENT_IMAGE_PATTERN, "![$1]");
}

export function mapApiStep(step: TestStepDto): EditableStep {
  return {
    id: step.id,
    action: stripInternalAttachmentImageSources(step.action),
    expectedResult: stripInternalAttachmentImageSources(step.expected_result),
    persisted: true,
  };
}

export function mapApiCoverage(coverage: TestCaseComponentCoverageDto): EditableCoverage {
  return {
    id: coverage.id,
    componentId: coverage.component_id,
    coverageType: coverage.coverage_type,
    coverageStrength: coverage.coverage_strength,
    isMandatoryForRelease: coverage.is_mandatory_for_release,
    persisted: true,
  };
}

export function normalizeStepsForSave(steps: EditableStep[]) {
  return steps.map((step, index) => ({
    position: index + 1,
    action: step.action,
    expected_result: step.expectedResult,
    client_id: step.id,
  }));
}

export function validateFileSize(file: File, limitBytes: number): boolean {
  return file.size <= limitBytes;
}

export function cloneSteps(steps: EditableStep[]): EditableStep[] {
  return steps.map((step) => ({ ...step }));
}

export function normalizeCoveragesForSave(coverages: EditableCoverage[]) {
  return coverages
    .filter((coverage) => coverage.componentId.trim().length > 0)
    .map((coverage) => ({
      component_id: coverage.componentId,
      coverage_type: coverage.coverageType,
      coverage_strength: coverage.coverageStrength,
      is_mandatory_for_release: coverage.isMandatoryForRelease,
    }));
}

export function cloneCoverages(coverages: EditorSnapshot["componentCoverages"]): EditorSnapshot["componentCoverages"] {
  return coverages.map((coverage) => ({ ...coverage }));
}

export function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    ...snapshot,
    tags: [...snapshot.tags],
    componentCoverages: cloneCoverages(snapshot.componentCoverages),
    steps: cloneSteps(snapshot.steps),
    templateType: snapshot.templateType,
    automationId: snapshot.automationId,
    stepsText: snapshot.stepsText,
    expected: snapshot.expected,
    rawTest: snapshot.rawTest,
    rawTestLanguage: snapshot.rawTestLanguage,
    time: snapshot.time,
    preconditions: snapshot.preconditions,
    testCaseAttachments: [...snapshot.testCaseAttachments],
    stepAttachments: Object.fromEntries(
      Object.entries(snapshot.stepAttachments).map(([stepId, atts]) => [stepId, [...atts]])
    ),
  };
}

export function getAvailableStatusOptions(
  status: EditorSnapshot["status"],
  allowAnyTransition: boolean
) {
  if (allowAnyTransition) {
    return ["draft", "active", "archived"] as const;
  }
  if (status === "draft") return ["draft", "active"] as const;
  if (status === "active") return ["active", "archived"] as const;
  return ["archived"] as const;
}
