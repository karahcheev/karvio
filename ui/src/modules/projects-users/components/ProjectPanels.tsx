// Project side panels: create project and read-only project summary.
import { useId } from "react";
import { FolderOpen, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Link } from "react-router";
import type { ProjectDto } from "@/shared/api";
import {
  SidePanel,
  SidePanelCard,
  SidePanelSection,
  sidePanelHeaderActions,
} from "@/shared/ui/SidePanel";
import {
  DetailsSection,
  EntityDetailsPanelLayout,
  MetaInfoCard,
} from "@/shared/ui/EntityDetailsPanelLayout";
import { Button } from "@/shared/ui/Button";

type NewProjectPanelProps = Readonly<{
  isCreating: boolean;
  newProjectDesc: string;
  newProjectName: string;
  onClose: () => void;
  onCreate: () => void;
  onProjectDescChange: (value: string) => void;
  onProjectNameChange: (value: string) => void;
}>;

export function NewProjectPanel({
  isCreating,
  newProjectDesc,
  newProjectName,
  onClose,
  onCreate,
  onProjectDescChange,
  onProjectNameChange,
}: NewProjectPanelProps) {
  const newProjectNameFieldId = useId();
  const newProjectDescFieldId = useId();

  return (
    <SidePanel
      title="New Project"
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="panel"
            onClick={onCreate}
            disabled={isCreating || !newProjectName.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <SidePanelSection>
          <SidePanelCard className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={newProjectNameFieldId}>
                Project Name <span className="text-[var(--status-failure)]">*</span>
              </label>
              <input
                id={newProjectNameFieldId}
                type="text"
                value={newProjectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]" htmlFor={newProjectDescFieldId}>
                Description
              </label>
              <textarea
                id={newProjectDescFieldId}
                rows={4}
                value={newProjectDesc}
                onChange={(e) => onProjectDescChange(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
              />
            </div>
          </SidePanelCard>
        </SidePanelSection>
      </div>
    </SidePanel>
  );
}

type ProjectDetailsPanelProps = Readonly<{
  onClose: () => void;
  onDelete: (projectId: string) => void;
  isDeleting: boolean;
  project: ProjectDto | null;
}>;

export function ProjectDetailsPanel({
  onClose,
  onDelete,
  isDeleting,
  project,
}: ProjectDetailsPanelProps) {
  if (!project) {
    return null;
  }

  return (
    <EntityDetailsPanelLayout
      title={project.name}
      onClose={onClose}
      actions={
        <>
          <Link
            to={`/projects/${project.id}/details`}
            className={sidePanelHeaderActions.secondary}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open
          </Link>
          <Link
            to={`/projects/${project.id}/details?mode=edit`}
            className={sidePanelHeaderActions.secondary}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <Link
            to={`/projects/${project.id}/details#members`}
            className={sidePanelHeaderActions.secondary}
          >
            <Users className="h-3.5 w-3.5" />
            Assign Members
          </Link>
          <Button
            type="button"
            variant="danger"
            size="panel"
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
    >
      <DetailsSection title="Metadata">
        <MetaInfoCard
          rows={[
            { label: "ID", value: project.id },
            { label: "Name", value: project.name },
            {
              label: "Description",
              value: project.description || "No description",
            },
            {
              label: "Created",
              value: new Date(project.created_at).toLocaleString(),
            },
          ]}
        />
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}
