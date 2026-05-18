export interface EditableStep {
  id: string;
  action: string;
  expectedResult: string;
  persisted: boolean;
}

export interface OwnerOption {
  id: string;
  username: string;
}

import type { CoverageStrength, CoverageType } from "@/shared/api";

export interface EditableCoverage {
  id: string;
  componentId: string;
  coverageType: CoverageType;
  coverageStrength: CoverageStrength;
  isMandatoryForRelease: boolean;
  persisted: boolean;
}

export type ProjectRole = "viewer" | "tester" | "lead" | "manager" | null;

export const TEST_CASE_MODES = ["view", "edit"] as const;

import type { AttachmentDto } from "@/shared/api";
import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";

export interface EditorSnapshot {
  title: string;
  templateType: TestCaseTemplateType;
  automationId: string | null;
  stepsText: string | null;
  expected: string | null;
  rawTest: string | null;
  rawTestLanguage: string | null;
  time: string | null;
  priority: TestCasePriority;
  status: "draft" | "active" | "archived";
  testCaseType: TestCaseType;
  ownerId: string;
  primaryProductId: string;
  suiteId: string;
  tags: string[];
  componentCoverages: EditableCoverage[];
  steps: EditableStep[];
  preconditions: string | null;
  testCaseAttachments: AttachmentDto[];
  stepAttachments: Record<string, AttachmentDto[]>;
}

export interface CloneWizardDraft {
  title: string;
  time: string | null;
  priority: TestCasePriority;
  testCaseType: TestCaseType;
  ownerId: string;
  suiteId: string;
  tags: string[];
  tagInput: string;
}
