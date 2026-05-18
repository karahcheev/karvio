import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ApiSortDirection,
  createProject,
  createUser,
  deleteProject,
  deleteUser,
  patchUser,
  setUserPassword,
  type ProjectDto,
  type UserDto,
  useProjectsQuery,
  useUsersQuery,
} from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import { validatePassword } from "@/shared/lib/password-policy";
import { WORKSPACE_TABS, type WorkspaceTab } from "@/modules/projects-users/components/ProjectsAndUsersTabs";
import type { ProjectColumn, UserColumn, UserEditDraft } from "@/modules/projects-users/utils";
import { getUserLabel, mapProjectSorting, mapUserSorting, toNullable, toUserEditDraft } from "@/modules/projects-users/utils";
import type { UnifiedTableSorting } from "@/shared/ui/Table";

export function useProjectsUsersPage() {
  const { confirmDelete } = useDeleteConfirmation();
  const [activeTab, setActiveTab] = useUrlHashState<WorkspaceTab>({
    values: WORKSPACE_TABS,
    defaultValue: "projects",
  });
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingStatusUserId, setIsUpdatingStatusUserId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);
  const [userUpdateError, setUserUpdateError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<string | null>(null);

  const projectsUsersRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectMenuOpen(null);
        setUserMenuOpen(null);
      }
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, []);

  useEffect(() => {
    const node = projectsUsersRootRef.current;
    if (!node) return;
    const closeOpenMenus = () => {
      setProjectMenuOpen(null);
      setUserMenuOpen(null);
    };
    node.addEventListener("click", closeOpenMenus);
    return () => node.removeEventListener("click", closeOpenMenus);
  }, []);

  const [renamingUserId, setRenamingUserId] = useState<string | null>(null);
  const [renameUserName, setRenameUserName] = useState("");
  const [isRenamingUser, setIsRenamingUser] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isUserEditMode, setIsUserEditMode] = useState(false);
  const [projectSorting, setProjectSorting] = useState<UnifiedTableSorting<ProjectColumn>>({ column: "created", direction: "desc" });
  const [userSorting, setUserSorting] = useState<UnifiedTableSorting<UserColumn>>({ column: "created", direction: "desc" });
  const [userEditDraft, setUserEditDraft] = useState<UserEditDraft | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);

  const projectsQuery = useProjectsQuery({
    sortBy: mapProjectSorting(projectSorting.column),
    sortDirection: projectSorting.direction as ApiSortDirection,
  });
  const usersQuery = useUsersQuery(activeTab === "users", {
    sortBy: mapUserSorting(userSorting.column),
    sortDirection: userSorting.direction as ApiSortDirection,
  });

  const isLoading = projectsQuery.isLoading || projectsQuery.isFetching;
  const isUsersLoading = usersQuery.isLoading || usersQuery.isFetching;
  const usersError = usersQuery.error ? "Failed to load users" : null;
  const selectedProject = projects.find((item) => item.id === selectedProjectId) ?? null;
  const selectedUser = users.find((item) => item.id === selectedUserId) ?? null;
  const resetPasswordUser = users.find((item) => item.id === resetPasswordUserId) ?? null;

  const hasSelectedUserChanges = useMemo(() => {
    if (!selectedUser || !userEditDraft) return false;
    return (
      userEditDraft.username.trim() !== selectedUser.username ||
      toNullable(userEditDraft.firstName) !== selectedUser.first_name ||
      toNullable(userEditDraft.lastName) !== selectedUser.last_name ||
      toNullable(userEditDraft.email) !== selectedUser.email ||
      toNullable(userEditDraft.team) !== selectedUser.team
    );
  }, [selectedUser, userEditDraft]);

  const loadProjects = async () => {
    await projectsQuery.refetch();
  };
  const loadUsers = async () => {
    await usersQuery.refetch();
  };

  useEffect(() => {
    setProjects(projectsQuery.data ?? []);
  }, [projectsQuery.data]);

  useEffect(() => {
    if (usersQuery.data) setUsers(usersQuery.data);
  }, [usersQuery.data]);

  useEffect(() => {
    if (!selectedUser) {
      setUserEditDraft(null);
      setIsUserEditMode(false);
      return;
    }
    if (!isUserEditMode) setUserEditDraft(toUserEditDraft(selectedUser));
  }, [isUserEditMode, selectedUser]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const project = await createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
      });
      setShowProjectPanel(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await loadProjects();
      notifySuccess(`Project "${project.name}" created`);
    } catch (error) {
      notifyError(error, "Failed to create project.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const projectName = projects.find((item) => item.id === projectId)?.name ?? "this project";
    const confirmed = await confirmDelete({
      title: "Delete Project",
      description: `Delete "${projectName}"? This action cannot be undone.`,
      confirmLabel: "Delete Project",
    });
    if (!confirmed) return;

    setDeletingProjectId(projectId);
    try {
      await deleteProject(projectId);
      if (selectedProjectId === projectId) setSelectedProjectId(null);
      setProjectMenuOpen(null);
      await loadProjects();
      notifySuccess("Project deleted");
    } catch (error) {
      notifyError(error, "Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserPassword.trim()) return;
    const passwordError = validatePassword(newUserPassword.trim());
    if (passwordError) {
      setUserCreateError(passwordError);
      return;
    }
    setIsCreatingUser(true);
    setUserCreateError(null);
    try {
      const user = await createUser({
        username: newUserName.trim(),
        password: newUserPassword.trim(),
        first_name: toNullable(newUserFirstName),
        last_name: toNullable(newUserLastName),
        email: toNullable(newUserEmail),
        team: toNullable(newUserTeam),
      });
      setUsers((prev) => [user, ...prev]);
      setNewUserName("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setNewUserEmail("");
      setNewUserTeam("");
      setShowUserPanel(false);
      await loadUsers();
      notifySuccess(`User "${getUserLabel(user)}" created`);
    } catch (error) {
      setUserCreateError(getErrorMessage(error, "Failed to create user."));
      notifyError(error, "Failed to create user.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleOpenUserDetails = (user: UserDto) => {
    setSelectedUserId(user.id);
    setUserEditDraft(toUserEditDraft(user));
    setIsUserEditMode(false);
    setUserUpdateError(null);
    setShowUserPanel(false);
    setShowProjectPanel(false);
    setSelectedProjectId(null);
  };

  const handleStartUserEdit = () => {
    if (!selectedUser) return;
    setUserEditDraft(toUserEditDraft(selectedUser));
    setIsUserEditMode(true);
    setUserUpdateError(null);
  };

  const handleCancelUserEdit = () => {
    if (selectedUser) setUserEditDraft(toUserEditDraft(selectedUser));
    setIsUserEditMode(false);
    setUserUpdateError(null);
  };

  const handleUserEditChange = (field: keyof UserEditDraft, value: string) => {
    setUserEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    setUserUpdateError(null);
  };

  const handleSaveUser = async () => {
    if (!isUserEditMode || !selectedUser || !userEditDraft) return;
    const nextUsername = userEditDraft.username.trim();
    if (!nextUsername) {
      setUserUpdateError("Username is required.");
      return;
    }

    const patchPayload: { username?: string; first_name?: string | null; last_name?: string | null; email?: string | null; team?: string | null } = {};
    const nextFirstName = toNullable(userEditDraft.firstName);
    const nextLastName = toNullable(userEditDraft.lastName);
    const nextEmail = toNullable(userEditDraft.email);
    const nextTeam = toNullable(userEditDraft.team);
    if (nextUsername !== selectedUser.username) patchPayload.username = nextUsername;
    if (nextFirstName !== selectedUser.first_name) patchPayload.first_name = nextFirstName;
    if (nextLastName !== selectedUser.last_name) patchPayload.last_name = nextLastName;
    if (nextEmail !== selectedUser.email) patchPayload.email = nextEmail;
    if (nextTeam !== selectedUser.team) patchPayload.team = nextTeam;
    if (Object.keys(patchPayload).length === 0) return;

    setIsSavingUser(true);
    setUserUpdateError(null);
    try {
      const updated = await patchUser(selectedUser.id, patchPayload);
      await loadUsers();
      setUserEditDraft(toUserEditDraft(updated));
      setIsUserEditMode(false);
      notifySuccess(`User "${getUserLabel(updated)}" updated`);
    } catch (error) {
      setUserUpdateError("Failed to update user. Username or email may already exist.");
      notifyError(error, "Failed to update user.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserEnabled = async (user: UserDto) => {
    setIsUpdatingStatusUserId(user.id);
    setUserUpdateError(null);
    try {
      const updated = await patchUser(user.id, { is_enabled: !user.is_enabled });
      await loadUsers();
      notifySuccess(`User "${updated.username}" ${updated.is_enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      setUserUpdateError("Failed to change user status.");
      notifyError(error, "Failed to change user status.");
    } finally {
      setIsUpdatingStatusUserId(null);
    }
  };

  const handleOpenResetPassword = (user: UserDto) => {
    setResetPasswordUserId(user.id);
    setResetPasswordValue("");
    setUserMenuOpen(null);
    setUserUpdateError(null);
  };

  const handleCloseResetPassword = () => {
    if (isResettingPassword) return;
    setResetPasswordUserId(null);
    setResetPasswordValue("");
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !resetPasswordValue.trim()) return;
    const passwordError = validatePassword(resetPasswordValue.trim());
    if (passwordError) {
      setUserUpdateError(passwordError);
      return;
    }
    setIsResettingPassword(true);
    setUserUpdateError(null);
    try {
      await setUserPassword(resetPasswordUser.id, { new_password: resetPasswordValue });
      setResetPasswordUserId(null);
      setResetPasswordValue("");
      notifySuccess(`Password reset for "${resetPasswordUser.username}"`);
    } catch (error) {
      setUserUpdateError(getErrorMessage(error, "Failed to reset password."));
      notifyError(error, "Failed to reset password.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find((item) => item.id === userId);
    const userLabel = user ? getUserLabel(user) : "this user";
    const confirmed = await confirmDelete({
      title: "Delete User",
      description: `Delete "${userLabel}"? This action cannot be undone.`,
      confirmLabel: "Delete User",
    });
    if (!confirmed) return;

    setDeletingUserId(userId);
    setUserUpdateError(null);
    try {
      await deleteUser(userId);
      if (selectedUserId === userId) setSelectedUserId(null);
      setUserMenuOpen(null);
      await loadUsers();
      notifySuccess("User deleted");
    } catch (error) {
      setUserUpdateError("Failed to delete user.");
      notifyError(error, "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const startRenameUser = (user: UserDto) => {
    setRenamingUserId(user.id);
    setRenameUserName(user.username);
    setUserMenuOpen(null);
    setUserUpdateError(null);
  };

  const cancelRenameUser = () => {
    setRenamingUserId(null);
    setRenameUserName("");
    setIsRenamingUser(false);
  };

  const submitRenameUser = async (user: UserDto) => {
    const nextName = renameUserName.trim();
    if (!nextName || nextName === user.username) {
      cancelRenameUser();
      return;
    }
    setIsRenamingUser(true);
    setUserUpdateError(null);
    try {
      const updated = await patchUser(user.id, { username: nextName });
      await loadUsers();
      cancelRenameUser();
      notifySuccess(`User renamed to "${updated.username}"`);
    } catch (error) {
      setUserUpdateError("Failed to rename user. Username may already exist.");
      setIsRenamingUser(false);
      notifyError(error, "Failed to rename user.");
    }
  };

  return {
    /** Root container for row action menus: click listener closes open menus (see effect). */
    projectsUsersRootRef,
    tabs: {
      activeTab,
      onChange: setActiveTab,
    },
    projects: {
      isActive: activeTab === "projects",
      deletingProjectId,
      isLoading,
      onDeleteProject: (projectId: string) => void handleDeleteProject(projectId),
      onOpenCreate: () => {
        setShowProjectPanel(true);
        setSelectedProjectId(null);
        setSelectedUserId(null);
        setShowUserPanel(false);
      },
      onOpenDetails: (projectId: string) => setSelectedProjectId(projectId),
      onToggleProject: (projectId: string) => {
        setSelectedProjectId(selectedProjectId === projectId ? null : projectId);
        setSelectedUserId(null);
        setShowProjectPanel(false);
        setShowUserPanel(false);
      },
      projectMenuOpen,
      projects,
      selectedProjectId,
      setProjectMenuOpen,
      sorting: projectSorting,
      onSortingChange: setProjectSorting,
    },
    users: {
      isActive: activeTab === "users",
      deletingUserId,
      isRenamingUser,
      isUpdatingStatusUserId,
      isUsersLoading,
      onAddUser: () => {
        setShowUserPanel(true);
        setSelectedUserId(null);
        setSelectedProjectId(null);
        setShowProjectPanel(false);
        setUserCreateError(null);
        setNewUserName("");
        setNewUserPassword("");
        setNewUserFirstName("");
        setNewUserLastName("");
        setNewUserEmail("");
        setNewUserTeam("");
      },
      onCancelRename: cancelRenameUser,
      onDeleteUser: (userId: string) => void handleDeleteUser(userId),
      onOpenUserDetails: handleOpenUserDetails,
      onOpenResetPassword: handleOpenResetPassword,
      onRefresh: () => void loadUsers(),
      onRenameInputChange: setRenameUserName,
      onStartRename: startRenameUser,
      onSubmitRename: submitRenameUser,
      onToggleUserEnabled: (user: UserDto) => void handleToggleUserEnabled(user),
      onToggleSelectedUser: (userId: string) => {
        if (selectedUserId === userId) {
          setSelectedUserId(null);
          setUserUpdateError(null);
        }
      },
      renamingUserId,
      renameUserName,
      selectedUserId,
      setUserMenuOpen,
      sorting: userSorting,
      userMenuOpen,
      users,
      usersError,
      onSortingChange: setUserSorting,
    },
    createProjectPanel: {
      isOpen: showProjectPanel,
      isCreating,
      newProjectDesc,
      newProjectName,
      onClose: () => setShowProjectPanel(false),
      onCreate: () => void handleCreateProject(),
      onProjectDescChange: setNewProjectDesc,
      onProjectNameChange: setNewProjectName,
    },
    createUserPanel: {
      isOpen: showUserPanel,
      isCreatingUser,
      newUserEmail,
      newUserFirstName,
      newUserLastName,
      newUserName,
      newUserPassword,
      newUserTeam,
      onAddUser: () => void handleAddUser(),
      onClose: () => setShowUserPanel(false),
      onUserEmailChange: setNewUserEmail,
      onUserFirstNameChange: setNewUserFirstName,
      onUserLastNameChange: setNewUserLastName,
      onUserNameChange: setNewUserName,
      onUserPasswordChange: setNewUserPassword,
      onUserTeamChange: setNewUserTeam,
      userCreateError,
    },
    projectDetailsPanel: {
      isOpen: Boolean(selectedProjectId),
      onClose: () => setSelectedProjectId(null),
      onDelete: (projectId: string) => void handleDeleteProject(projectId),
      isDeleting: deletingProjectId === selectedProjectId,
      project: selectedProject,
    },
    userDetailsPanel: {
      isOpen: Boolean(selectedUserId),
      deletingUserId,
      editEmail: userEditDraft?.email ?? "",
      editFirstName: userEditDraft?.firstName ?? "",
      editLastName: userEditDraft?.lastName ?? "",
      editTeam: userEditDraft?.team ?? "",
      editUsername: userEditDraft?.username ?? "",
      isEditMode: isUserEditMode,
      isSaveDisabled: !hasSelectedUserChanges || isSavingUser || !(userEditDraft?.username.trim() ?? ""),
      isSavingUser,
      isUpdatingStatusUserId,
      onClose: () => {
        setSelectedUserId(null);
        setIsUserEditMode(false);
      },
      onCancelEdit: handleCancelUserEdit,
      onDeleteUser: (userId: string) => void handleDeleteUser(userId),
      onEditEmailChange: (value: string) => handleUserEditChange("email", value),
      onEditFirstNameChange: (value: string) => handleUserEditChange("firstName", value),
      onEditLastNameChange: (value: string) => handleUserEditChange("lastName", value),
      onEditTeamChange: (value: string) => handleUserEditChange("team", value),
      onEditUsernameChange: (value: string) => handleUserEditChange("username", value),
      onOpenResetPassword: handleOpenResetPassword,
      onSaveUser: () => void handleSaveUser(),
      onStartEdit: handleStartUserEdit,
      onToggleUserEnabled: (user: UserDto) => void handleToggleUserEnabled(user),
      user: selectedUser,
      userUpdateError,
    },
    resetPasswordModal: {
      isOpen: Boolean(resetPasswordUser),
      isSubmitting: isResettingPassword,
      newPassword: resetPasswordValue,
      onClose: handleCloseResetPassword,
      onNewPasswordChange: setResetPasswordValue,
      onSubmit: () => void handleResetPassword(),
      user: resetPasswordUser,
    },
  };
}
