// Test cases browser and full test case detail with clone modal.
import { downloadTestCaseAttachment } from "@/shared/api";
import { TestCaseAiReviewPanel, TestCaseAttachmentsTab, TestCaseCloneModal, TestCaseCodeBlock, TestCaseContentBlock, TestCaseCreateModal, TestCaseDatasetsSection, TestCaseDefectsTab, TestCaseDetailHeader, TestCaseDetailsForm, TestCasePreviewPanel, TestCaseResultsHistory, TestCaseStepsSection, TestCasesBulkActions, TestCasesSuiteTree, TestCasesTable, TestCasesToolbar } from "./components";
import type { CloneWizardDraft } from "./components";
import { useTestCaseDetail } from "./hooks/use-test-case-detail";
import { useTestCasesPage } from "./hooks/use-test-cases-page";
import { ArrowLeft, Plus, RotateCw } from "lucide-react";
import { Button, ListPageEmptyState } from "@/shared/ui";
import { UnderlineTabs } from "@/shared/ui/Tabs";

export function TestCasesModulePage() {
  const model = useTestCasesPage();
  const isSearchActive = model.toolbar.searchQuery.trim().length > 0;

  return (
    <div className="flex h-full bg-[var(--table-canvas)]">
      <TestCasesSuiteTree {...model.suiteTree} />

      {/* List, toolbar, pagination */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TestCasesToolbar {...model.toolbar} />
        <TestCasesBulkActions {...model.bulkActions} />
        {(() => {
          if (model.list.isLoading) {
            return (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--table-canvas)] p-3 text-sm text-[var(--muted-foreground)]">
                Loading test cases...
              </div>
            );
          }
          if (model.list.error) {
            return (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--table-canvas)] p-3 text-sm text-[var(--status-failure)]">
                {model.list.error}
              </div>
            );
          }
          if (model.table.tests.length === 0) {
            const emptyDescription = isSearchActive
              ? "Try a different search term or adjust filters and suite selection."
              : "Create a new test case or adjust filters and suite selection.";
            return (
              <div className="flex min-h-0 flex-1 flex-col items-stretch overflow-auto bg-[var(--table-canvas)] p-3 pt-2">
                <ListPageEmptyState
                  title="No test cases found"
                  description={emptyDescription}
                  actions={
                    isSearchActive ? undefined : (
                      <Button
                        unstyled
                        type="button"
                        onClick={model.toolbar.onNewTestCaseClick}
                        className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
                      >
                        <Plus className="h-4 w-4" />
                        New Test Case
                      </Button>
                    )
                  }
                />
              </div>
            );
          }
          return <TestCasesTable {...model.table} />;
        })()}
      </div>

      {/* Create / preview drawers */}
      <TestCaseCreateModal {...model.createPanel} />
      {model.previewPanel.isOpen && model.previewPanel.testCase ? <TestCasePreviewPanel {...model.previewPanel} testCase={model.previewPanel.testCase} /> : null}
    </div>
  );
}

export function TestCaseDetailModulePage() {
  const model = useTestCaseDetail();
  const allAttachmentsCount = new Set([
    ...model.testCaseAttachments.map((attachment) => attachment.id),
    ...Object.values(model.stepAttachments)
      .flat()
      .map((attachment) => attachment.id),
  ]).size;

  if (model.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--table-canvas)]">
        <div className="text-sm text-[var(--muted-foreground)]">Loading test case…</div>
      </div>
    );
  }

  if (model.error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--table-canvas)] p-6">
        <section className="w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Unable to load test case</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{model.error}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" size="md" leftIcon={<ArrowLeft />} onClick={() => window.history.back()}>
              Back
            </Button>
            <Button type="button" variant="primary" size="md" leftIcon={<RotateCw />} onClick={model.refetch}>
              Retry
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[var(--table-canvas)]">
      <TestCaseDetailHeader
        projectId={model.projectId}
        title={model.title}
        testCaseKey={model.key}
        createdAt={model.createdAt}
        updatedAt={model.updatedAt}
        isEditing={model.isEditing}
        isSaving={model.isSaving}
        aiEnabled={model.aiEnabled}
        isUploadingCaseAttachment={model.isUploadingCaseAttachment}
        actionsMenuOpen={model.actionsMenuOpen}
        actionsMenuRef={model.actionsMenuRef}
        caseAttachmentInputRef={model.caseAttachmentInputRef}
        locationSearch={model.location.search}
        onActionsMenuToggle={() => model.setActionsMenuOpen((current) => !current)}
        onCloneOpen={model.handleCloneOpen}
        onReviewWithAi={() => void model.handleRunAiReview()}
        onArchive={model.handleArchive}
        onDelete={model.handleDelete}
        onCaseAttachmentSelect={(file) => void model.handleCaseAttachmentUpload(file)}
        onEditStart={model.handleEditStart}
        onCancelEdit={model.handleCancelEdit}
        onSave={model.handleSave}
      />

      {/* Fields and steps */}
      <div className="p-3">
        {model.aiEnabled ? (
          <TestCaseAiReviewPanel
            review={model.aiReview}
            isReviewing={model.isReviewingWithAi}
            onRunReview={() => void model.handleRunAiReview()}
            onApplyField={model.handleApplyAiReviewField}
          />
        ) : null}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <UnderlineTabs
            value={model.activeTab}
            onChange={model.setActiveTab}
            items={[
              { value: "details", label: "Details" },
              { value: "attachments", label: `Attachments (${allAttachmentsCount})` },
              { value: "datasets", label: `Datasets (${model.datasetsCount})` },
              { value: "results-history", label: "Results history" },
              { value: "defects", label: `Defects (${model.externalIssues.length})` },
            ]}
          />
          <div className="p-3">
            {(() => {
              if (model.activeTab === "details") {
                return (
              <div className="space-y-4 [&>*+*]:border-t [&>*+*]:border-[var(--border)] [&>*+*]:pt-4">
                <TestCaseDetailsForm
                  isEditing={model.isEditing}
                  title={model.title}
                  onTitleChange={model.setTitle}
                  templateType={model.templateType}
                  onTemplateTypeChange={(value) => {
                    model.setTemplateType(value);
                    if (value === "automated") {
                      model.setTestCaseType("automated");
                    }
                  }}
                  automationId={model.automationId}
                  onAutomationIdChange={(value) => model.setAutomationId(value)}
                  time={model.time}
                  onTimeChange={(value) => model.setTime(value)}
                  status={model.status}
                  onStatusChange={model.setStatus}
                  priority={model.priority}
                  onPriorityChange={model.setPriority}
                  testCaseType={model.testCaseType}
                  onTestCaseTypeChange={model.setTestCaseType}
                  availableStatusOptions={model.availableStatusOptions}
                  tags={model.tags}
                  externalIssues={model.externalIssues}
                  canManageExternalIssues={model.canManageExternalIssues}
                  externalIssueActionLoading={model.externalIssueActionLoading}
                  tagInput={model.tagInput}
                  onTagInputChange={model.setTagInput}
                  onAddTag={model.addTag}
                  onRemoveTag={model.removeTag}
                  handleLinkExternalIssue={(value) => void model.handleLinkExternalIssue(value)}
                  handleUnlinkExternalIssue={(linkId) => void model.handleUnlinkExternalIssue(linkId)}
                  ownerId={model.ownerId}
                  onOwnerIdChange={model.setOwnerId}
                  ownerLabel={model.ownerLabel}
                  owners={model.owners}
                  primaryProductId={model.primaryProductId}
                  onPrimaryProductIdChange={model.setPrimaryProductId}
                  productLabel={model.productLabel}
                  products={model.products}
                  componentCoverages={model.componentCoverages}
                  onAddCoverage={model.addCoverage}
                  onRemoveCoverage={model.removeCoverage}
                  onCoverageComponentChange={model.updateCoverageComponent}
                  onCoverageStrengthChange={model.updateCoverageStrength}
                  onCoverageMandatoryChange={model.updateCoverageMandatory}
                  components={model.components}
                  suiteId={model.suiteId}
                  onSuiteIdChange={model.setSuiteId}
                  suiteLabel={model.suiteLabel}
                  suites={model.suites}
                />

                {(model.templateType === "text" || model.templateType === "steps") ? (
                  <TestCaseContentBlock
                    title="Preconditions"
                    value={model.preconditions}
                    isEditing={model.isEditing}
                    placeholder="Describe prerequisites for this case..."
                    onChange={model.setPreconditions}
                    onImageUpload={model.handleCaseInlineImageUpload}
                    canUploadImage={!model.isUploadingCaseAttachment}
                    testCaseId={model.testCaseId}
                    attachments={model.testCaseAttachments}
                    fieldKey="preconditions"
                  />
                ) : null}

                {model.templateType === "text" ? (
                  <TestCaseContentBlock
                    title="Steps"
                    value={model.stepsText}
                    isEditing={model.isEditing}
                    placeholder="Describe the execution flow..."
                    onChange={model.setStepsText}
                    onImageUpload={model.handleCaseInlineImageUpload}
                    canUploadImage={!model.isUploadingCaseAttachment}
                    testCaseId={model.testCaseId}
                    attachments={model.testCaseAttachments}
                    fieldKey="steps"
                  />
                ) : null}

                {model.templateType === "text" ? (
                  <TestCaseContentBlock
                    title="Expected"
                    value={model.expected}
                    isEditing={model.isEditing}
                    placeholder="Describe the expected outcome..."
                    onChange={model.setExpected}
                    onImageUpload={model.handleCaseInlineImageUpload}
                    canUploadImage={!model.isUploadingCaseAttachment}
                    testCaseId={model.testCaseId}
                    attachments={model.testCaseAttachments}
                    fieldKey="expected"
                  />
                ) : null}

                {model.templateType === "automated" ? (
                  <TestCaseCodeBlock
                    title="Raw Test"
                    value={model.rawTest}
                    language={model.rawTestLanguage}
                    isEditing={model.isEditing}
                    placeholder="Paste the automated test source code here..."
                    onChange={model.setRawTest}
                    onLanguageChange={model.setRawTestLanguage}
                    unboxed
                  />
                ) : null}

                {model.templateType === "steps" ? (
                  <TestCaseStepsSection
                    isEditing={model.isEditing}
                    steps={model.steps}
                    stepAttachments={model.stepAttachments}
                    testCaseId={model.testCaseId}
                    uploadingStepId={model.uploadingStepId}
                    unboxed
                    onAddStep={model.addStep}
                    onInsertStepAfter={model.insertStepAfter}
                    onRemoveStep={model.removeStep}
                    onUpdateStep={model.updateStep}
                    onMoveStep={model.moveStep}
                    onStepImageUpload={model.handleStepInlineImageUpload}
                  />
                ) : null}
              </div>
                );
              }
              if (model.activeTab === "attachments") {
                return (
              <TestCaseAttachmentsTab
                isEditing={model.isEditing}
                testCaseAttachments={model.testCaseAttachments}
                stepAttachments={model.stepAttachments}
                onAttachmentUpload={model.handleCaseAttachmentUpload}
                onAttachmentDelete={model.handleCaseAttachmentDelete}
                onAttachmentDownload={(attachment) =>
                  model.testCaseId
                    ? downloadTestCaseAttachment(model.testCaseId, attachment.id, attachment.filename)
                    : Promise.resolve()
                }
              />
                );
              }
              if (model.activeTab === "datasets") {
                return (
              <TestCaseDatasetsSection
                isEditing={model.isEditing}
                canEditDatasets={model.canEditDatasets}
                canDeleteDatasets={model.canDeleteDatasets}
                datasets={model.datasets}
                availableDatasets={model.availableDatasets}
                availableDatasetsHasMore={model.availableDatasetsHasMore}
                isLoadingAvailableDatasets={model.isLoadingAvailableDatasets}
                isLoadingMoreAvailableDatasets={model.isLoadingMoreAvailableDatasets}
                onLoadMoreAvailableDatasets={model.handleLoadMoreAvailableDatasets}
                bindDatasetSearch={model.bindDatasetSearch}
                onBindDatasetSearchChange={model.setBindDatasetSearch}
                boundDatasetsPagination={model.boundDatasetsPagination}
                selectedExistingDatasetId={model.selectedExistingDatasetId}
                onSelectedExistingDatasetIdChange={model.setSelectedExistingDatasetId}
                draft={model.datasetDraft}
                onDraftChange={model.setDatasetDraft}
                isLoading={model.datasetsLoading}
                isSaving={model.datasetsSaving}
                isCreating={model.isCreatingDataset}
                editingDatasetId={model.editingDatasetId}
                onCreateStart={model.handleDatasetCreateStart}
                onEditStart={model.handleDatasetEditStart}
                onCancelForm={model.handleDatasetCancelForm}
                onSave={model.handleDatasetSave}
                onBindExisting={model.handleBindExistingDataset}
                onOpenDatasetDetails={model.handleOpenDatasetDetails}
                onUnbind={model.handleUnbindDataset}
                onDelete={model.handleDeleteDataset}
              />
                );
              }
              if (model.activeTab === "defects") {
                return (
              <TestCaseDefectsTab
                projectId={model.projectId}
                testCaseId={model.testCaseId}
                directIssues={model.externalIssues}
                canManageExternalIssues={model.canManageExternalIssues}
                externalIssueActionLoading={model.externalIssueActionLoading}
                onLinkIssue={(value) => model.handleLinkExternalIssue(value)}
                onUnlinkIssue={(issue) => void model.handleUnlinkDefectIssue(issue)}
              />
                );
              }
              return <TestCaseResultsHistory projectId={model.projectId} testCaseId={model.testCaseId} />;
            })()}
          </div>
        </div>
      </div>

      {/* Clone wizard */}
      <TestCaseCloneModal
        isOpen={model.isCloneWizardOpen}
        isCloning={model.isCloning}
        draft={model.cloneWizardDraft}
        owners={model.owners}
        suites={model.suites}
        stepsCount={model.steps.length}
        onClose={model.handleCloneClose}
        onDraftChange={(field, value) =>
          model.setCloneWizardDraft((current: CloneWizardDraft) => ({
            ...current,
            [field]: value,
          }))
        }
        onAddTag={model.addCloneTag}
        onRemoveTag={model.removeCloneTag}
        onCreate={() => void model.handleCloneCreate()}
      />
    </div>
  );
}
