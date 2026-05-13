import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import type { ProjectMemberRole, UserDto } from "@/shared/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useUsersSearchQuery } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { Select } from "@/shared/ui/Select";
import { SearchableEntityPicker } from "@/shared/ui";
import { AppModal, WizardModalLayout } from "@/shared/ui/Modal";

const MEMBER_ROLES: ProjectMemberRole[] = ["viewer", "tester", "lead", "manager"];
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_ROLE: ProjectMemberRole = "tester";

export type PendingMember = {
  userId: string;
  role: ProjectMemberRole;
};

type AddMemberModalProps = Readonly<{
  isOpen: boolean;
  excludeUserIds: string[];
  isAdding: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (members: PendingMember[]) => void;
}>;

export function AddMemberModal({
  isOpen,
  excludeUserIds,
  isAdding,
  error,
  onClose,
  onAdd,
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  // userId -> UserDto for selected users (persists even when user scrolls away)
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserDto>>(new Map());
  // userId -> role
  const [userRoles, setUserRoles] = useState<Map<string, ProjectMemberRole>>(new Map());

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const searchQueryResult = useUsersSearchQuery(debouncedSearch, {
    sortBy: "username",
    sortDirection: "asc",
    enabled: isOpen,
  });

  const searchedUsers = useMemo(
    () => searchQueryResult.data?.pages.flatMap((p) => p.items) ?? [],
    [searchQueryResult.data?.pages],
  );
  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const availableUsers = useMemo(
    () => searchedUsers.filter((user) => !excludeSet.has(user.id)),
    [searchedUsers, excludeSet],
  );

  const hasNextPage = searchQueryResult.hasNextPage ?? false;
  const isFetching = searchQueryResult.isFetching;
  const isFetchingNextPage = searchQueryResult.isFetchingNextPage;

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setSelectedUsers(new Map());
    setUserRoles(new Map());
  }, [isOpen]);

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void searchQueryResult.fetchNextPage();
    }
  };

  const handleToggleUser = useCallback((user: UserDto) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
    setUserRoles((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, DEFAULT_ROLE);
      }
      return next;
    });
  }, []);

  const handleRemoveUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
    setUserRoles((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const handleRoleChange = useCallback((userId: string, role: ProjectMemberRole) => {
    setUserRoles((prev) => new Map(prev).set(userId, role));
  }, []);

  const pendingMembers: PendingMember[] = useMemo(
    () =>
      Array.from(selectedUsers.keys()).map((userId) => ({
        userId,
        role: userRoles.get(userId) ?? DEFAULT_ROLE,
      })),
    [selectedUsers, userRoles],
  );

  const selectedUserList = useMemo(() => Array.from(selectedUsers.values()), [selectedUsers]);
  const count = selectedUserList.length;

  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isAdding}
      closeOnEscape={!isAdding}
      contentClassName="sm:max-w-5xl rounded-xl"
    >
      <WizardModalLayout
        title="Add Members"
        description="Select one or more users and assign each a role."
        onClose={onClose}
        closeButtonDisabled={isAdding}
        sidebarClassName="w-2/5"
        mainClassName="w-3/5"
        sidebar={
          <SearchableEntityPicker
            searchLabel="Users"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by username..."
            isLoading={isFetching}
            items={availableUsers}
            getKey={(user) => user.id}
            isSelected={(user) => selectedUsers.has(user.id)}
            onToggle={handleToggleUser}
            selectionType="checkbox"
            name="user"
            getItemClassName={(_, selected) =>
              selected
                ? "bg-[var(--highlight-bg-soft)] border-[var(--highlight-border)]"
                : "hover:bg-[var(--muted)]"
            }
            listClassName="max-h-[340px] overflow-y-auto"
            emptyState={
              <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-center text-sm text-[var(--muted-foreground)]">
                {searchQuery.trim() ? "No users match search" : "Type to search users"}
              </p>
            }
            hasMore={hasNextPage}
            onLoadMore={handleLoadMore}
            isLoadingMore={isFetchingNextPage}
            renderItem={(user) => {
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
              return (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{user.username}</span>
                    {fullName && (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">{fullName}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {user.email && (
                      <span className="truncate text-xs text-[var(--muted-foreground)]">{user.email}</span>
                    )}
                    {user.team && (
                      <span className="shrink-0 rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {user.team}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          />
        }
        mainHeader={
          <p className="text-sm font-medium text-[var(--foreground)]">
            Selected{" "}
            <span className="ml-1 rounded-full bg-[var(--highlight-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--highlight-foreground)]">
              {count}
            </span>
          </p>
        }
        footer={
          <>
            <Button
              unstyled
              onClick={onClose}
              disabled={isAdding}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </Button>
            <Button
              unstyled
              onClick={() => onAdd(pendingMembers)}
              disabled={isAdding || count === 0}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {isAdding
                ? "Adding..."
                : count === 0
                  ? "Add Members"
                  : count === 1
                    ? "Add 1 Member"
                    : `Add ${count} Members`}
            </Button>
          </>
        }
      >
        {count === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
            <UserPlus className="h-8 w-8 text-[var(--muted-foreground)] opacity-40" />
            <p className="text-sm text-[var(--muted-foreground)]">
              Search and select users on the left
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedUserList.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{user.username}</span>
                    {user.team && (
                      <span className="shrink-0 rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                        {user.team}
                      </span>
                    )}
                  </div>
                  {user.email && (
                    <p className="truncate text-xs text-[var(--muted-foreground)]">{user.email}</p>
                  )}
                </div>
                <div className="w-32 shrink-0">
                  <Select
                    value={userRoles.get(user.id) ?? DEFAULT_ROLE}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as ProjectMemberRole)}
                    disabled={isAdding}
                    className="h-8 py-1 text-xs"
                  >
                    {MEMBER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  unstyled
                  onClick={() => handleRemoveUser(user.id)}
                  disabled={isAdding}
                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${user.username}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-[var(--status-failure)]">{error}</p>
        )}
      </WizardModalLayout>
    </AppModal>
  );
}
