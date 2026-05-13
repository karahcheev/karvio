import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  type ApiSortDirection,
  createProjectMember,
  deleteProject,
  deleteProjectMember,
  getProject,
  getProjectMembers,
  getUsersPage,
  patchProject,
  patchProjectMember,
  type ProjectDto,
  type ProjectMemberDto,
  type ProjectMemberRole,
  type ProjectMembersSortBy,
  type UserDto,
} from "@/shared/api";
import type { PendingMember } from "../components/AddMemberModal";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import type { UnifiedTableSorting } from "@/shared/ui/Table";

type MemberColumn = "user" | "role" | "added";
type ProjectMemberTableRow = ProjectMemberDto & { username: string };
export type ProjectTab = "details" | "members";

function mapMemberSorting(column: MemberColumn): ProjectMembersSortBy {
  switch (column) {
    case "user":
      return "username";
    case "role":
      return "role";
    case "added":
      return "created_at";
  }
}

export function useProjectDetailsPage() {
  const { confirmDelete } = useDeleteConfirmation();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldOpenInEditMode = searchParams.get("mode") === "edit";
  const [activeTab, setActiveTab] = useUrlHashState<ProjectTab>({
    values: ["details", "members"],
    defaultValue: "details",
  });
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(shouldOpenInEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<UserDto[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [memberColumnsOpen, setMemberColumnsOpen] = useState(false);
  const [visibleMemberColumns, setVisibleMemberColumns] = useState<Set<MemberColumn>>(new Set(["user", "role", "added"]));
  const [memberSorting, setMemberSorting] = useState<UnifiedTableSorting<MemberColumn>>({
    column: "added",
    direction: "desc",
  });

  useEffect(() => {
    if (!projectId) return;
    setIsLoading(true);
    getProject(projectId)
      .then((item) => {
        setProject(item);
        setName(item.name);
        setDescription(item.description ?? "");
        setIsEditMode(shouldOpenInEditMode);
      })
      .finally(() => setIsLoading(false));
  }, [projectId, shouldOpenInEditMode]);

  const loadProjectMembers = useCallback(async () => {
    if (!projectId) return;
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const items = await getProjectMembers(projectId, {
        sortBy: mapMemberSorting(memberSorting.column),
        sortDirection: memberSorting.direction as ApiSortDirection,
      });
      setMembers(items);
    } catch {
      setMembersError("Failed to load project members.");
    } finally {
      setIsMembersLoading(false);
    }
  }, [memberSorting.column, memberSorting.direction, projectId]);

  useEffect(() => {
    if (activeTab !== "members" || !projectId) return;
    void loadProjectMembers();
    setMemberActionError(null);
  }, [activeTab, loadProjectMembers, projectId]);

  const handleSave = async () => {
    if (!projectId || !project) return;
    setIsSaving(true);
    try {
      const updated = await patchProject(projectId, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setProject(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      setIsEditMode(false);
      notifySuccess(`Project "${updated.name}" updated`);
    } catch (error) {
      notifyError(error, "Failed to update project.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    const confirmed = await confirmDelete({
      title: "Delete Project",
      description: `Delete "${project?.name ?? "this project"}"? This action cannot be undone.`,
      confirmLabel: "Delete Project",
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      notifySuccess("Project deleted");
      navigate("/");
    } catch (error) {
      notifyError(error, "Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadWorkspaceUsersForDisplay = useCallback(async () => {
    try {
      const result = await getUsersPage({
        pageSize: 100,
        sortBy: "username",
        sortOrder: "asc",
      });
      setWorkspaceUsers(result.items);
    } catch {
      setMemberActionError("Failed to load users.");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "members") {
      void loadWorkspaceUsersForDisplay();
    }
  }, [activeTab, loadWorkspaceUsersForDisplay]);

  const usersById = useMemo(() => new Map(workspaceUsers.map((user) => [user.id, user])), [workspaceUsers]);
  const memberRows: ProjectMemberTableRow[] = useMemo(
    () => members.map((member) => ({ ...member, username: usersById.get(member.user_id)?.username ?? "Unknown user" })),
    [members, usersById],
  );

  const handleAddMembers = async (pending: PendingMember[]) => {
    if (!projectId || pending.length === 0) return;
    setIsAddingMember(true);
    setMemberActionError(null);
    try {
      const results = await Promise.allSettled(
        pending.map(({ userId, role }) =>
          createProjectMember({ project_id: projectId, user_id: userId, role }),
        ),
      );
      await loadProjectMembers();
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        notifySuccess(succeeded === 1 ? "1 member added to project" : `${succeeded} members added to project`);
      }
      if (failed > 0) {
        setMemberActionError(`${failed} member(s) could not be added. They may already be in this project.`);
      } else {
        setShowAddMemberModal(false);
      }
    } catch (error) {
      setMemberActionError("Failed to add members.");
      notifyError(error, "Failed to add members.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: ProjectMemberRole) => {
    setUpdatingMemberId(memberId);
    setMemberActionError(null);
    try {
      const updated = await patchProjectMember(memberId, { role });
      await loadProjectMembers();
      const username = usersById.get(updated.user_id)?.username ?? "Member";
      notifySuccess(`Role for ${username} updated`);
    } catch (error) {
      setMemberActionError("Failed to update member role.");
      notifyError(error, "Failed to update member role.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    const username = member ? usersById.get(member.user_id)?.username ?? "Member" : "Member";
    const confirmed = await confirmDelete({
      title: "Remove Member",
      description: `Remove "${username}" from this project?`,
      confirmLabel: "Remove Member",
    });
    if (!confirmed) return;

    setDeletingMemberId(memberId);
    setMemberActionError(null);
    try {
      await deleteProjectMember(memberId);
      await loadProjectMembers();
      notifySuccess(`${username} removed from project`);
    } catch (error) {
      setMemberActionError("Failed to remove member.");
      notifyError(error, "Failed to remove member.");
    } finally {
      setDeletingMemberId(null);
    }
  };

  const toggleMemberColumn = (column: MemberColumn) => {
    const next = new Set(visibleMemberColumns);
    if (next.has(column)) next.delete(column);
    else next.add(column);
    setVisibleMemberColumns(next);
  };

  const handleStartEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setIsEditMode(false);
  };

  return {
    header: {
      project,
      projectId,
      isEditMode,
      isSaving,
      onStartEdit: handleStartEdit,
      onCancelEdit: handleCancelEdit,
      onSaveProject: () => void handleSave(),
      onDeleteProject: () => void handleDeleteProject(),
      isDeleting,
    },
    tabs: {
      activeTab,
      onChange: setActiveTab,
    },
    detailsForm: {
      isVisible: activeTab === "details",
      projectId,
      name,
      description,
      isLoading,
      isEditMode,
      onNameChange: setName,
      onDescriptionChange: setDescription,
    },
    membersTable: {
      isVisible: activeTab === "members",
      members: memberRows,
      isLoading: isMembersLoading,
      error: membersError,
      isUsersLoading: false,
      availableUsersCount: undefined,
      memberActionError,
      visibleColumns: visibleMemberColumns,
      columnsOpen: memberColumnsOpen,
      sorting: memberSorting,
      updatingMemberId,
      deletingMemberId,
      onAddMember: () => {
        setMemberActionError(null);
        setShowAddMemberModal(true);
      },
      onRoleChange: (memberId: string, role: ProjectMemberRole) => void handleRoleChange(memberId, role),
      onDeleteMember: (memberId: string) => void handleDeleteMember(memberId),
      onToggleColumn: toggleMemberColumn,
      onColumnsOpenChange: setMemberColumnsOpen,
      onSortingChange: setMemberSorting,
    },
    addMemberModal: {
      isOpen: showAddMemberModal,
      excludeUserIds: members.map((m) => m.user_id),
      isAdding: isAddingMember,
      error: memberActionError,
      onClose: () => setShowAddMemberModal(false),
      onAdd: (pending: PendingMember[]) => void handleAddMembers(pending),
    },
  };
}
