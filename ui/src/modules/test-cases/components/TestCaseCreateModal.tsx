// Modal form for creating a new test case in a suite.
import { AlertTriangle, Check, Loader2, Plus, RotateCw, Sparkles, X } from "lucide-react";
import { useCallback, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { DialogContent } from "@/shared/ui/Dialog";
import type { NewTestCaseForm, SuiteNode } from "../utils/types";
import { isNewTestCaseFormDirty } from "../utils/newTestCaseForm";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { Button } from "@/shared/ui/Button";
import { FormField, RichTextField, SelectField, TagInput, TextareaField, TextField } from "@/shared/ui";
import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import { TestCaseCodeBlock } from "./TestCaseCodeBlock";
import {
  TestCaseAutomationIdField,
  TestCaseExpectedTimeField,
  TestCaseTemplateTypeField,
  TestCaseTypePriorityFields,
} from "./TestCaseCommonFormFields";
import { TestCaseStepsSection } from "./TestCaseStepsSection";
import { TestCaseCoverageEditor, type ComponentOption, type ProductOption } from "./TestCaseCoverageEditor";
import type { AiDraftTestCaseDto } from "@/shared/api";

const CREATE_STATUS_OPTIONS = ["draft", "active"] as const satisfies readonly NewTestCaseForm["status"][];

export type TestCaseCreateOwnerOption = {
  id: string;
  username: string;
};

type Props = Readonly<{
  isOpen: boolean;
  isSubmitting: boolean;
  projectId: string | undefined;
  ownerOptions: TestCaseCreateOwnerOption[];
  selectedSuite: string | null;
  suites: SuiteNode[];
  newTestCase: NewTestCaseForm;
  setNewTestCase: Dispatch<SetStateAction<NewTestCaseForm>>;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onAddCoverage: () => void;
  onRemoveCoverage: (coverageId: string) => void;
  onCoverageComponentChange: (coverageId: string, componentId: string) => void;
  onCoverageStrengthChange: (
    coverageId: string,
    coverageStrength: NewTestCaseForm["componentCoverages"][number]["coverageStrength"]
  ) => void;
  onCoverageMandatoryChange: (coverageId: string, isMandatoryForRelease: boolean) => void;
  onCancel: () => void;
  onCreate: () => void;
  productOptions: ProductOption[];
  componentOptions: ComponentOption[];
  onAddStep: () => void;
  onInsertStepAfter: (afterId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, field: "action" | "expectedResult", value: string) => void;
  onMoveStep: (sourceId: string, targetId: string) => void;
  uploadingStepId: string | null;
  onStepImageUpload: (stepId: string, file: File) => Promise<string | null>;
  onPreconditionsImageUpload: (file: File) => Promise<string | null>;
  aiEnabled: boolean;
  aiSourceText: string;
  aiDrafts: AiDraftTestCaseDto[];
  aiWarnings: string[];
  duplicateWarnings: AiDraftTestCaseDto["possible_duplicates"];
  isGeneratingAiDrafts: boolean;
  isCheckingDuplicates: boolean;
  onAiSourceTextChange: (value: string) => void;
  onGenerateAiDrafts: () => void;
  onAcceptAiDraft: (draft: AiDraftTestCaseDto) => void;
  onAcceptAllAiDrafts: () => void;
  onRejectAiDraft: (index: number) => void;
  onCheckDuplicates: () => void;
}>;

export function TestCaseCreateModal({
  isOpen,
  isSubmitting,
  projectId,
  ownerOptions,
  selectedSuite,
  suites,
  newTestCase,
  setNewTestCase,
  onAddTag,
  onRemoveTag,
  onAddCoverage,
  onRemoveCoverage,
  onCoverageComponentChange,
  onCoverageStrengthChange,
  onCoverageMandatoryChange,
  onCancel,
  onCreate,
  productOptions,
  componentOptions,
  onAddStep,
  onInsertStepAfter,
  onRemoveStep,
  onUpdateStep,
  onMoveStep,
  uploadingStepId,
  onStepImageUpload,
  onPreconditionsImageUpload,
  aiEnabled,
  aiSourceText,
  aiDrafts,
  aiWarnings,
  duplicateWarnings,
  isGeneratingAiDrafts,
  isCheckingDuplicates,
  onAiSourceTextChange,
  onGenerateAiDrafts,
  onAcceptAiDraft,
  onAcceptAllAiDrafts,
  onRejectAiDraft,
  onCheckDuplicates,
}: Props) {
  const { confirmDelete } = useDeleteConfirmation();
  const effectiveTestCaseType = newTestCase.templateType === "automated" ? "automated" : newTestCase.testCaseType;

  const handlePointerDownOutside = useCallback<NonNullable<ComponentProps<typeof DialogContent>["onPointerDownOutside"]>>(
    (event) => {
      if (isSubmitting) return;
      if (!isNewTestCaseFormDirty(newTestCase)) return;
      event.preventDefault();
      void confirmDelete({
        title: "Close without saving?",
        description: "You have entered data in this form. If you close it now, your changes will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
      }).then((confirmed) => {
        if (confirmed) onCancel();
      });
    },
    [confirmDelete, isSubmitting, newTestCase, onCancel]
  );

  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onCancel}
      closeOnOverlayClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
      onPointerDownOutside={handlePointerDownOutside}
      contentClassName="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden rounded-xl sm:max-w-4xl"
    >
      <StandardModalLayout
        title="New Test Case"
        description="Fill in the details and create the test case."
        onClose={onCancel}
        closeButtonDisabled={isSubmitting}
        bodyClassName="space-y-5"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onCreate}
              disabled={!newTestCase.title.trim() || isSubmitting}
            >
              <Plus className="h-3.5 w-3.5" />
              Create
            </Button>
          </>
        }
      >
        {aiEnabled ? (
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <TextareaField
                  label="AI source"
                  value={aiSourceText}
                  placeholder="Paste a feature, bug, acceptance criteria, or risk note..."
                  rows={3}
                  onChange={(event) => onAiSourceTextChange(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={onGenerateAiDrafts}
                disabled={isSubmitting || isGeneratingAiDrafts}
              >
                {isGeneratingAiDrafts ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            </div>
            {aiWarnings.length > 0 ? (
              <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
                {aiWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {aiDrafts.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Generated drafts
                  </p>
                  <Button type="button" variant="outline" onClick={onAcceptAllAiDrafts} disabled={isSubmitting}>
                    <Check className="h-3.5 w-3.5" />
                    Accept All
                  </Button>
                </div>
                {aiDrafts.map((draft, index) => (
                  <div key={`${draft.title}-${index}`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{draft.title}</h3>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{draft.suggestion_reason}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" onClick={() => onAcceptAiDraft(draft)}>
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => onRejectAiDraft(index)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {draft.priority}
                      </span>
                      {draft.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {draft.possible_duplicates.length > 0 ? (
                      <DuplicateWarningList projectId={projectId} duplicates={draft.possible_duplicates} />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <TextField
            label="Title"
            required
            type="text"
            value={newTestCase.title}
            onChange={(event) => setNewTestCase({ ...newTestCase, title: event.target.value })}
            placeholder="Enter test case title..."
            autoFocus
          />

          {aiEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCheckDuplicates}
                disabled={!newTestCase.title.trim() || isCheckingDuplicates}
              >
                {isCheckingDuplicates ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )}
                Check Similar
              </Button>
              {duplicateWarnings.length > 0 ? (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {duplicateWarnings.length} similar case{duplicateWarnings.length === 1 ? "" : "s"} found
                </span>
              ) : null}
            </div>
          ) : null}

          {duplicateWarnings.length > 0 ? (
            <DuplicateWarningList projectId={projectId} duplicates={duplicateWarnings} />
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TestCaseTemplateTypeField
              value={newTestCase.templateType}
              onChange={(value) => {
                const nextType = value as NewTestCaseForm["templateType"];
                setNewTestCase({
                  ...newTestCase,
                  templateType: nextType,
                  testCaseType: value === "automated" ? "automated" : newTestCase.testCaseType,
                  steps: nextType === "steps" ? newTestCase.steps : [],
                });
              }}
            />

            <TestCaseAutomationIdField
              value={newTestCase.automationId}
              onChange={(value) => setNewTestCase({ ...newTestCase, automationId: value })}
              placeholder="Optional stable id for JUnit mapping"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SelectField
              label="Status"
              value={newTestCase.status}
              onChange={(event) =>
                setNewTestCase({
                  ...newTestCase,
                  status: event.target.value as NewTestCaseForm["status"],
                })
              }
            >
              {CREATE_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatTestCaseStatusLabel(option)}
                </option>
              ))}
            </SelectField>
            <TestCaseExpectedTimeField
              value={newTestCase.time}
              onChange={(value) => setNewTestCase({ ...newTestCase, time: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TestCaseTypePriorityFields
              typeValue={effectiveTestCaseType}
              typeDisabled={newTestCase.templateType === "automated"}
              onTypeChange={(value) =>
                setNewTestCase({ ...newTestCase, testCaseType: value as NewTestCaseForm["testCaseType"] })
              }
              priorityValue={newTestCase.priority}
              onPriorityChange={(value) =>
                setNewTestCase({ ...newTestCase, priority: value as NewTestCaseForm["priority"] })
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SelectField
              label="Owner"
              value={newTestCase.ownerId}
              onChange={(event) => setNewTestCase({ ...newTestCase, ownerId: event.target.value })}
            >
              <option value="unassigned">Unassigned</option>
              {ownerOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.username}
                </option>
              ))}
            </SelectField>
            <FormField label="Tags" className="min-w-0">
              <TagInput
                tags={newTestCase.tags}
                tagInput={newTestCase.tagInput}
                onTagInputChange={(value) => setNewTestCase({ ...newTestCase, tagInput: value })}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                layout="stacked"
                addButtonStyle="muted"
              />
            </FormField>
          </div>

          <TestCaseCoverageEditor
            isEditing
            primaryProductId={newTestCase.primaryProductId}
            onPrimaryProductIdChange={(primaryProductId) => setNewTestCase({ ...newTestCase, primaryProductId })}
            componentCoverages={newTestCase.componentCoverages.map((coverage) => ({ ...coverage, persisted: false }))}
            onAddCoverage={onAddCoverage}
            onRemoveCoverage={onRemoveCoverage}
            onCoverageComponentChange={onCoverageComponentChange}
            onCoverageStrengthChange={onCoverageStrengthChange}
            onCoverageMandatoryChange={onCoverageMandatoryChange}
            productOptions={productOptions}
            componentOptions={componentOptions}
          />

          {newTestCase.templateType === "text" ? (
            <div className="space-y-4">
              <RichTextField
                label="Preconditions"
                value={newTestCase.preconditions}
                editable
                emptyMessage="No preconditions specified."
                placeholder="Describe prerequisites for this case..."
                minRows={4}
                onChange={(value) => setNewTestCase({ ...newTestCase, preconditions: value })}
                onImageUpload={onPreconditionsImageUpload}
                imageUploadTitle="Upload image"
              />
              <TextareaField
                label="Steps"
                value={newTestCase.stepsText}
                placeholder="Describe the execution flow..."
                rows={4}
                onChange={(event) => setNewTestCase({ ...newTestCase, stepsText: event.target.value })}
              />
              <TextareaField
                label="Expected"
                value={newTestCase.expected}
                placeholder="Describe the expected result..."
                rows={4}
                onChange={(event) => setNewTestCase({ ...newTestCase, expected: event.target.value })}
              />
            </div>
          ) : null}

          {newTestCase.templateType === "steps" ? (
            <div className="space-y-4">
              <RichTextField
                label="Preconditions"
                value={newTestCase.preconditions}
                editable
                emptyMessage="No preconditions specified."
                placeholder="Describe prerequisites for this case..."
                minRows={4}
                onChange={(value) => setNewTestCase({ ...newTestCase, preconditions: value })}
                onImageUpload={onPreconditionsImageUpload}
                imageUploadTitle="Upload image"
              />
              <TestCaseStepsSection
                isEditing
                steps={newTestCase.steps}
                stepAttachments={{}}
                uploadingStepId={uploadingStepId}
                stepImagesEnabled
                unboxed
                onAddStep={onAddStep}
                onInsertStepAfter={onInsertStepAfter}
                onRemoveStep={onRemoveStep}
                onUpdateStep={onUpdateStep}
                onMoveStep={onMoveStep}
                onStepImageUpload={onStepImageUpload}
              />
            </div>
          ) : null}

          {newTestCase.templateType === "automated" ? (
            <TestCaseCodeBlock
              title="Raw Test"
              value={newTestCase.rawTest}
              language={newTestCase.rawTestLanguage}
              isEditing
              placeholder="Paste the automated test source code here..."
              onChange={(value) => setNewTestCase({ ...newTestCase, rawTest: value })}
              onLanguageChange={(value) => setNewTestCase({ ...newTestCase, rawTestLanguage: value })}
            />
          ) : null}

          {selectedSuite ? (
            <FormField label="Suite">
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)]">
                {suites.find((suite) => suite.id === selectedSuite)?.name || "All Tests"}
              </div>
            </FormField>
          ) : null}
      </StandardModalLayout>
    </AppModal>
  );
}

function DuplicateWarningList({
  projectId,
  duplicates,
}: Readonly<{
  projectId: string | undefined;
  duplicates: AiDraftTestCaseDto["possible_duplicates"];
}>) {
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] p-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
        <AlertTriangle className="h-3.5 w-3.5" />
        Similar test cases
      </div>
      {duplicates.map((item) => (
        <div key={item.candidate_test_case_id} className="text-xs text-[var(--muted-foreground)]">
          <a
            className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
            href={projectId ? `/projects/${projectId}/test-cases/${item.candidate_test_case_id}` : undefined}
            target="_blank"
            rel="noreferrer"
          >
            {item.key}: {item.title}
          </a>
          <span> · {Math.round(item.similarity_score * 100)}% · {item.reason}</span>
        </div>
      ))}
    </div>
  );
}
