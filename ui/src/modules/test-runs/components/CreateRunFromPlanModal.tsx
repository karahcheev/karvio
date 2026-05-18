// Creates a test run from a plan template with run metadata.
import { useCallback } from "react";
import type { TestPlanDto } from "@/shared/api";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { RunMetadataFields, RunSubmitActions } from "./RunFormSections";
import { UNASSIGNED_ASSIGNEE, useRunMetadataFormState } from "../hooks/use-run-metadata-form-state";
import type { EnvironmentOption, MilestoneOption } from "./CreateTestRunModal";

export type AssigneeOption = { id: string; label: string };

type Props = Readonly<{
  isOpen: boolean;
  loading: boolean;
  plan: TestPlanDto | null;
  assigneeOptions: AssigneeOption[];
  environmentOptions: EnvironmentOption[];
  milestoneOptions: MilestoneOption[];
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description: string;
    environment_id?: string;
    milestone_id?: string | null;
    build: string;
    assignee: string | null;
    start_immediately: boolean;
  }) => void;
}>;

export function CreateRunFromPlanModal({
  isOpen,
  loading,
  plan,
  assigneeOptions,
  environmentOptions,
  milestoneOptions,
  onClose,
  onSubmit,
}: Props) {
  const getInitialState = useCallback(
    () => ({
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      environmentId: "",
      milestoneId: plan?.milestone_id ?? "",
      build: "",
      assignee: UNASSIGNED_ASSIGNEE,
    }),
    [plan],
  );

  const {
    state: metadata,
    setName,
    setDescription,
    setEnvironmentId,
    setMilestoneId,
    setBuild,
    setAssignee,
    reset,
  } = useRunMetadataFormState({
    isOpen,
    getInitialState,
  });

  const resetAndClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (startImmediately: boolean) => {
    if (!metadata.name.trim() || loading) return;
    onSubmit({
      name: metadata.name.trim(),
      description: metadata.description || "",
      environment_id: metadata.environmentId.trim() || undefined,
      milestone_id: metadata.milestoneId.trim() || null,
      build: metadata.build || "",
      assignee: metadata.assignee === UNASSIGNED_ASSIGNEE ? null : metadata.assignee,
      start_immediately: startImmediately,
    });
  };

  if (!isOpen || !plan) return null;

  return (
    <AppModal isOpen={isOpen} onClose={resetAndClose} contentClassName="max-w-md rounded-xl">
      <StandardModalLayout
        title="Create Run from Plan"
        description={(
          <>
            Plan: <span className="font-medium text-[var(--foreground)]">{plan.name}</span>
          </>
        )}
        onClose={resetAndClose}
        closeButtonDisabled={loading}
        footer={(
          <RunSubmitActions
            loading={loading}
            disabled={!metadata.name.trim() || loading}
            onCancel={resetAndClose}
            onCreate={() => handleSubmit(false)}
            onCreateAndStart={() => handleSubmit(true)}
          />
        )}
      >
        <RunMetadataFields
            values={metadata}
            assigneeOptions={assigneeOptions}
            environmentOptions={environmentOptions}
            milestoneOptions={milestoneOptions}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onEnvironmentChange={setEnvironmentId}
            onMilestoneChange={setMilestoneId}
            onBuildChange={setBuild}
          onAssigneeChange={setAssignee}
          descriptionRows={2}
          hintsVariant="compact"
        />
      </StandardModalLayout>
    </AppModal>
  );
}
