// Projects and users admin: tabbed lists, side panels, and project detail page.
import { Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { DetailPageHeader } from "@/shared/ui/DetailPageHeader";
import { AddMemberModal, NewProjectPanel, NewUserPanel, ProjectDetailsForm, ProjectDetailsPanel, ProjectMembersTable, ProjectTabs, ProjectsAndUsersTabs, ProjectsTab, ResetPasswordModal, UserDetailsPanel, UsersTab } from "./components";
import { useProjectDetailsPage } from "./hooks/use-project-details-page";
import { useProjectsUsersPage } from "./hooks/use-projects-users-page";

export function ProjectsUsersModulePage() {
  const model = useProjectsUsersPage();
  const { projectsUsersRootRef, tabs, projects, users, createProjectPanel, createUserPanel, projectDetailsPanel, userDetailsPanel, resetPasswordModal } =
    model;

  return (
    <div ref={projectsUsersRootRef} className="relative flex h-full flex-col overflow-hidden bg-[var(--table-canvas)]">
      <ProjectsAndUsersTabs {...tabs} />

      {/* Active tab content */}
      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        {projects.isActive ? <ProjectsTab {...projects} /> : null}
        {users.isActive ? <UsersTab {...users} /> : null}
      </div>

      {/* Overlays */}
      {createProjectPanel.isOpen ? <NewProjectPanel {...createProjectPanel} /> : null}
      {createUserPanel.isOpen ? <NewUserPanel {...createUserPanel} /> : null}
      {projectDetailsPanel.isOpen ? <ProjectDetailsPanel {...projectDetailsPanel} /> : null}
      {userDetailsPanel.isOpen ? <UserDetailsPanel {...userDetailsPanel} /> : null}
      <ResetPasswordModal {...resetPasswordModal} />
    </div>
  );
}

export function ProjectDetailsModulePage() {
  const model = useProjectDetailsPage();

  return (
    <div className="h-full overflow-auto bg-[var(--table-canvas)]">
      <DetailPageHeader
        backLabel="Back to Projects"
        backTo="/projects-and-users"
        title={model.header.project?.name ?? "Loading..."}
        meta={
          <>
            <span>Project</span>
            <span>{model.header.project?.id ? `ID ${model.header.project.id}` : "ID —"}</span>
          </>
        }
        actions={
          <>
            {model.header.isEditMode ? (
              <>
                <Button
                  unstyled
                  onClick={model.header.onCancelEdit}
                  disabled={model.header.isSaving}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  unstyled
                  onClick={model.header.onSaveProject}
                  disabled={model.header.isSaving || !model.header.project}
                  className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {model.header.isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button
                unstyled
                onClick={model.header.onStartEdit}
                disabled={!model.header.project}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              unstyled
              onClick={model.header.onDeleteProject}
              disabled={!model.header.project || model.header.isDeleting}
              className="flex items-center gap-2 rounded-lg border border-[var(--tone-danger-border-strong)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Project
            </Button>
          </>
        }
      />

      <ProjectTabs {...model.tabs} />

      {/* Details and members */}
      <div className="p-3">
        {model.detailsForm.isVisible ? <ProjectDetailsForm {...model.detailsForm} /> : null}
        {model.membersTable.isVisible ? <ProjectMembersTable {...model.membersTable} /> : null}
      </div>

      {model.addMemberModal.isOpen ? <AddMemberModal {...model.addMemberModal} /> : null}
    </div>
  );
}
