export type SuiteNode = {
  id: string;
  name: string;
  parent: string | null;
  count: number;
  depth: number;
  /** Non-archived cases directly in this suite (from API); aggregate count is derived in the tree. */
  testCasesCount: number;
};

import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";
import type { EditableStep } from "./testCaseEditorTypes";
import type { CoverageStrength, CoverageType } from "@/shared/api";

export type TestCaseListItem = {
  id: string;
  testCaseId: string;
  suiteId: string | null;
  ownerId: string | null;
  title: string;
  time: string | null;
  status: "draft" | "active" | "archived";
  priority: TestCasePriority;
  testCaseType: TestCaseType;
  owner: string;
  suite: string;
  tags: string[];
  lastRun: string;
  lastStatus: string | null;
};

export type NewTestCaseForm = {
  title: string;
  templateType: TestCaseTemplateType;
  automationId: string;
  preconditions: string;
  stepsText: string;
  expected: string;
  rawTest: string;
  rawTestLanguage: string;
  status: "draft" | "active" | "archived";
  time: string;
  priority: TestCasePriority;
  testCaseType: TestCaseType;
  /** "unassigned" or project member user id */
  ownerId: string;
  /** "none" or product id */
  primaryProductId: string;
  tags: string[];
  tagInput: string;
  steps: EditableStep[];
  componentCoverages: Array<{
    id: string;
    componentId: string;
    coverageType: CoverageType;
    coverageStrength: CoverageStrength;
    isMandatoryForRelease: boolean;
  }>;
};

export type TestCaseColumn = "id" | "title" | "suite" | "tags" | "status" | "priority" | "type" | "owner" | "lastRun";
