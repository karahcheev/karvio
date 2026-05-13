// User side panels: create user, view/edit details, and reset-password modal.
import {
  KeyRound,
  Pencil,
  Save,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import type { UserDto } from "@/shared/api";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import {
  SidePanel,
  SidePanelCard,
  SidePanelSection,
} from "@/shared/ui/SidePanel";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui";
import { PASSWORD_POLICY_HINT } from "@/shared/lib/password-policy";
import {
  DetailsSection,
  EntityDetailsPanelLayout,
  EntitySummaryCard,
  MetaInfoCard,
} from "@/shared/ui/EntityDetailsPanelLayout";

function userEnableToggleButtonLabel(
  isUpdatingStatusUserId: string | null,
  userId: string,
  isEnabled: boolean,
): string {
  if (isUpdatingStatusUserId === userId) {
    return "Updating...";
  }
  return isEnabled ? "Disable" : "Enable";
}

type UserDetailsPanelProfileSectionProps = Readonly<{
  editEmail: string;
  editFirstName: string;
  editLastName: string;
  editTeam: string;
  editUsername: string;
  isEditMode: boolean;
  onEditEmailChange: (value: string) => void;
  onEditFirstNameChange: (value: string) => void;
  onEditLastNameChange: (value: string) => void;
  onEditTeamChange: (value: string) => void;
  onEditUsernameChange: (value: string) => void;
  user: UserDto;
}>;

function UserDetailsPanelProfileSection({
  editEmail,
  editFirstName,
  editLastName,
  editTeam,
  editUsername,
  isEditMode,
  onEditEmailChange,
  onEditFirstNameChange,
  onEditLastNameChange,
  onEditTeamChange,
  onEditUsernameChange,
  user,
}: UserDetailsPanelProfileSectionProps) {
  if (isEditMode) {
    return (
      <div className="space-y-4">
        <MetaInfoCard
          rows={[
            { label: "ID", value: user.id },
            {
              label: "Created",
              value: new Date(user.created_at).toLocaleString(),
            },
            {
              label: "Last updated",
              value: new Date(user.updated_at).toLocaleString(),
            },
            {
              label: "Last login",
              value: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never",
            },
          ]}
        />
        <SidePanelCard className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Name"
              type="text"
              value={editFirstName}
              onChange={(event) => onEditFirstNameChange(event.target.value)}
              placeholder="e.g. John"
            />
            <TextField
              label="Surname"
              type="text"
              value={editLastName}
              onChange={(event) => onEditLastNameChange(event.target.value)}
              placeholder="e.g. Doe"
            />
          </div>
          <TextField
            label="Email"
            type="email"
            value={editEmail}
            onChange={(event) => onEditEmailChange(event.target.value)}
            placeholder="e.g. john.doe@company.com"
          />
          <TextField
            label="Team"
            type="text"
            value={editTeam}
            onChange={(event) => onEditTeamChange(event.target.value)}
            placeholder="e.g. QA"
          />
          <TextField
            label="Username"
            required
            type="text"
            value={editUsername}
            onChange={(event) => onEditUsernameChange(event.target.value)}
            placeholder="e.g. john.doe"
          />
        </SidePanelCard>
      </div>
    );
  }

  return (
    <MetaInfoCard
      rows={[
        { label: "ID", value: user.id },
        { label: "Email", value: user.email },
        { label: "Username", value: user.username },
        { label: "Team", value: user.team },
        {
          label: "Created",
          value: new Date(user.created_at).toLocaleString(),
        },
        {
          label: "Last updated",
          value: new Date(user.updated_at).toLocaleString(),
        },
        {
          label: "Last login",
          value: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never",
        },
      ]}
    />
  );
}

type NewUserPanelProps = Readonly<{
  isCreatingUser: boolean;
  newUserEmail: string;
  newUserFirstName: string;
  newUserLastName: string;
  newUserName: string;
  newUserPassword: string;
  newUserTeam: string;
  onAddUser: () => void;
  onClose: () => void;
  onUserEmailChange: (value: string) => void;
  onUserFirstNameChange: (value: string) => void;
  onUserLastNameChange: (value: string) => void;
  onUserNameChange: (value: string) => void;
  onUserPasswordChange: (value: string) => void;
  onUserTeamChange: (value: string) => void;
  userCreateError: string | null;
}>;

export function NewUserPanel({
  isCreatingUser,
  newUserEmail,
  newUserFirstName,
  newUserLastName,
  newUserName,
  newUserPassword,
  newUserTeam,
  onAddUser,
  onClose,
  onUserEmailChange,
  onUserFirstNameChange,
  onUserLastNameChange,
  onUserNameChange,
  onUserPasswordChange,
  onUserTeamChange,
  userCreateError,
}: NewUserPanelProps) {
  return (
    <SidePanel
      title="Add User"
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
            onClick={onAddUser}
            disabled={
              isCreatingUser || !newUserName.trim() || !newUserPassword.trim()
            }
          >
            <UserPlus className="h-3.5 w-3.5" />
            {isCreatingUser ? "Adding..." : "Add"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <SidePanelSection>
          <SidePanelCard className="space-y-4">
            {/* Profile and credentials */}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Name"
                type="text"
                value={newUserFirstName}
                onChange={(event) => onUserFirstNameChange(event.target.value)}
                placeholder="e.g. John"
              />
              <TextField
                label="Surname"
                type="text"
                value={newUserLastName}
                onChange={(event) => onUserLastNameChange(event.target.value)}
                placeholder="e.g. Doe"
              />
            </div>
            <TextField
              label="Email"
              type="email"
              value={newUserEmail}
              onChange={(event) => onUserEmailChange(event.target.value)}
              placeholder="e.g. john.doe@company.com"
            />
            <TextField
              label="Team"
              type="text"
              value={newUserTeam}
              onChange={(event) => onUserTeamChange(event.target.value)}
              placeholder="e.g. QA"
            />
            <TextField
              label="Username"
              required
              type="text"
              value={newUserName}
              onChange={(event) => onUserNameChange(event.target.value)}
              placeholder="e.g. john.doe"
              autoFocus
            />
            <TextField
              label="Password"
              required
              type="password"
              value={newUserPassword}
              onChange={(event) => onUserPasswordChange(event.target.value)}
              placeholder="Strong password"
            />
            <p className="text-xs text-[var(--muted-foreground)]">{PASSWORD_POLICY_HINT}</p>
            {userCreateError ? (
              <p className="text-sm text-[var(--status-failure)]">{userCreateError}</p>
            ) : null}
          </SidePanelCard>
        </SidePanelSection>
      </div>
    </SidePanel>
  );
}

type UserDetailsPanelProps = Readonly<{
  deletingUserId: string | null;
  editEmail: string;
  editFirstName: string;
  editLastName: string;
  editTeam: string;
  editUsername: string;
  isEditMode: boolean;
  isSaveDisabled: boolean;
  isSavingUser: boolean;
  isUpdatingStatusUserId: string | null;
  onClose: () => void;
  onCancelEdit: () => void;
  onDeleteUser: (userId: string) => void;
  onEditEmailChange: (value: string) => void;
  onEditFirstNameChange: (value: string) => void;
  onEditLastNameChange: (value: string) => void;
  onEditTeamChange: (value: string) => void;
  onEditUsernameChange: (value: string) => void;
  onOpenResetPassword: (user: UserDto) => void;
  onSaveUser: () => void;
  onStartEdit: () => void;
  onToggleUserEnabled: (user: UserDto) => void;
  user: UserDto | null;
  userUpdateError: string | null;
}>;

export function UserDetailsPanel({
  deletingUserId,
  editEmail,
  editFirstName,
  editLastName,
  editTeam,
  editUsername,
  isEditMode,
  isSaveDisabled,
  isSavingUser,
  isUpdatingStatusUserId,
  onClose,
  onCancelEdit,
  onDeleteUser,
  onEditEmailChange,
  onEditFirstNameChange,
  onEditLastNameChange,
  onEditTeamChange,
  onEditUsernameChange,
  onOpenResetPassword,
  onSaveUser,
  onStartEdit,
  onToggleUserEnabled,
  user,
  userUpdateError,
}: UserDetailsPanelProps) {
  if (!user) {
    return null;
  }

  return (
    <EntityDetailsPanelLayout
      title={user.username}
      onClose={onClose}
      actions={
        isEditMode ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="panel"
              onClick={onCancelEdit}
              disabled={isSavingUser}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="panel"
              onClick={onSaveUser}
              disabled={isSaveDisabled}
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingUser ? "Saving..." : "Save"}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="panel"
              onClick={onStartEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              unstyled
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                user.is_enabled
                  ? "bg-[var(--status-blocked)] hover:bg-[color-mix(in_srgb,var(--status-blocked),transparent_10%)]"
                  : "bg-[var(--status-passed)] hover:bg-[color-mix(in_srgb,var(--status-passed),transparent_10%)]"
              }`}
              onClick={() => onToggleUserEnabled(user)}
              disabled={isUpdatingStatusUserId === user.id}
            >
              {user.is_enabled ? (
                <UserX className="h-3.5 w-3.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              {userEnableToggleButtonLabel(isUpdatingStatusUserId, user.id, user.is_enabled)}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="panel"
              onClick={() => onOpenResetPassword(user)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Reset Password
            </Button>
            <Button
              type="button"
              variant="danger"
              size="panel"
              onClick={() => onDeleteUser(user.id)}
              disabled={deletingUserId === user.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingUserId === user.id ? "Deleting..." : "Delete"}
            </Button>
          </>
        )
      }
    >
      <DetailsSection title="Profile">
        <UserDetailsPanelProfileSection
          editEmail={editEmail}
          editFirstName={editFirstName}
          editLastName={editLastName}
          editTeam={editTeam}
          editUsername={editUsername}
          isEditMode={isEditMode}
          onEditEmailChange={onEditEmailChange}
          onEditFirstNameChange={onEditFirstNameChange}
          onEditLastNameChange={onEditLastNameChange}
          onEditTeamChange={onEditTeamChange}
          onEditUsernameChange={onEditUsernameChange}
          user={user}
        />
      </DetailsSection>

      {userUpdateError ? (
        <p className="text-sm text-[var(--status-failure)]">{userUpdateError}</p>
      ) : null}

      <DetailsSection
        title="Project roles"
        description="Memberships across workspace projects."
      >
        <EntitySummaryCard>
          {user.project_memberships.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No project assignments.</p>
          ) : (
            <div className="space-y-3">
              {user.project_memberships.map((membership) => (
                <div
                  key={`${membership.project_id}-${membership.role}`}
                  className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-b-0 last:pb-0 first:pt-0"
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {membership.project_name}
                  </span>
                  <span className="rounded-full bg-[var(--highlight-bg)] px-2 py-0.5 text-xs font-medium text-[var(--highlight-foreground)]">
                    {membership.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </EntitySummaryCard>
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}

type ResetPasswordModalProps = Readonly<{
  isOpen: boolean;
  isSubmitting: boolean;
  newPassword: string;
  onClose: () => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: () => void;
  user: UserDto | null;
}>;

export function ResetPasswordModal({
  isOpen,
  isSubmitting,
  newPassword,
  onClose,
  onNewPasswordChange,
  onSubmit,
  user,
}: ResetPasswordModalProps) {
  if (!isOpen || !user) {
    return null;
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnEscape={!isSubmitting}
      closeOnOverlayClick={!isSubmitting}
      contentClassName="max-w-md rounded-xl border border-[var(--border)]"
    >
      <StandardModalLayout
        title="Reset Password"
        description={
          <>
            Set a new password for{" "}
            <span className="font-medium text-[var(--foreground)]">{user.username}</span>.
          </>
        }
        onClose={onClose}
        closeButtonDisabled={isSubmitting}
        footer={
          <>
            <Button
              unstyled
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              unstyled
              className="flex-1 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSubmit}
              disabled={isSubmitting || !newPassword.trim()}
            >
              {isSubmitting ? "Resetting..." : "Reset"}
            </Button>
          </>
        }
      >
        <TextField
          label="New Password"
          required
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          placeholder="Strong password"
          autoFocus
        />
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{PASSWORD_POLICY_HINT}</p>
      </StandardModalLayout>
    </AppModal>
  );
}
