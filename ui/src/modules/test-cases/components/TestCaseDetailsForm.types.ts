import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";
import type { ExternalIssueLinkDto } from "@/shared/api";
import type { EditableCoverage } from "@/modules/test-cases/utils/testCaseEditorTypes";

export type TestCaseDetailsFormProps = Readonly<{
  isEditing: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  templateType: TestCaseTemplateType;
  onTemplateTypeChange: (value: TestCaseTemplateType) => void;
  automationId: string | null;
  onAutomationIdChange: (value: string) => void;
  time: string | null;
  onTimeChange: (value: string) => void;
  status: "draft" | "active" | "archived";
  onStatusChange: (value: "draft" | "active" | "archived") => void;
  priority: TestCasePriority;
  onPriorityChange: (value: TestCasePriority) => void;
  testCaseType: TestCaseType;
  onTestCaseTypeChange: (value: TestCaseType) => void;
  availableStatusOptions: readonly ("draft" | "active" | "archived")[];
  tags: string[];
  externalIssues: ExternalIssueLinkDto[];
  canManageExternalIssues: boolean;
  externalIssueActionLoading: boolean;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  handleLinkExternalIssue: (issueKeyOrUrl: string) => void;
  handleUnlinkExternalIssue: (linkId: string) => void;
  ownerId: string;
  onOwnerIdChange: (value: string) => void;
  ownerLabel: string;
  owners: Array<{ id: string; username: string }>;
  primaryProductId: string;
  onPrimaryProductIdChange: (value: string) => void;
  productLabel: string;
  products: Array<{ id: string; name: string }>;
  componentCoverages: EditableCoverage[];
  onAddCoverage: () => void;
  onRemoveCoverage: (coverageId: string) => void;
  onCoverageComponentChange: (coverageId: string, componentId: string) => void;
  onCoverageStrengthChange: (
    coverageId: string,
    coverageStrength: EditableCoverage["coverageStrength"]
  ) => void;
  onCoverageMandatoryChange: (coverageId: string, isMandatoryForRelease: boolean) => void;
  components: Array<{ id: string; name: string }>;
  suiteId: string;
  onSuiteIdChange: (value: string) => void;
  suiteLabel: string;
  suites: Array<{ id: string; name: string }>;
}>;

export type TestCaseDetailsSharedProps = TestCaseDetailsFormProps &
  Readonly<{
    effectiveTestCaseType: TestCaseType;
    testCaseTypeLocked: boolean;
  }>;
