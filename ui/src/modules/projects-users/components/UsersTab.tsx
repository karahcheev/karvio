// Users tab: filters, table, and inline rename via row actions.
import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import type { UserDto } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { EntityListPage } from "@/shared/ui/EntityListPage";
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableSorting } from "@/shared/ui/Table";
import { Button } from "@/shared/ui/Button";
import { DateTimeCell, IdCell, PrimarySecondaryCell, StatusCell } from "@/shared/ui/table-cells";

type UserColumn = "id" | "user" | "email" | "team" | "projects" | "status" | "last_login" | "created" | "updated";
type UserStatusFilter = "enabled" | "disabled";

// Table helpers
function getFullName(user: UserDto): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
}

const USER_COLUMNS: UnifiedTableColumn<UserDto, UserColumn>[] = [
  {
    id: "id",
    label: "ID",
    menuLabel: "ID",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 190,
    minWidth: 72,
    renderCell: (user) => <IdCell value={user.id} />,
    cellClassName: "font-mono text-xs text-[var(--muted-foreground)]",
  },
  {
    id: "user",
    label: "User",
    menuLabel: "User",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 260,
    minWidth: 120,
    renderCell: (user) => {
      const fullName = getFullName(user);
      return (
        <PrimarySecondaryCell
          primary={fullName || user.username}
          secondary={fullName ? `@${user.username}` : undefined}
        />
      );
    },
  },
  {
    id: "email",
    label: "Email",
    menuLabel: "Email",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 260,
    minWidth: 120,
    renderCell: (user) => <span className="block truncate">{user.email || "—"}</span>,
    cellClassName: "text-[var(--foreground)]",
  },
  {
    id: "team",
    label: "Team",
    menuLabel: "Team",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 180,
    minWidth: 100,
    renderCell: (user) => <span className="block truncate">{user.team || "—"}</span>,
    cellClassName: "text-[var(--foreground)]",
  },
  {
    id: "projects",
    label: "Projects",
    menuLabel: "Projects",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 96,
    minWidth: 56,
    renderCell: (user) => user.project_memberships.length,
    cellClassName: "text-[var(--foreground)]",
  },
  {
    id: "status",
    label: "Status",
    menuLabel: "Status",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 112,
    minWidth: 72,
    renderCell: (user) => (
      <StatusCell tone={user.is_enabled ? "success" : "danger"} className="px-2 py-1">
        {user.is_enabled ? "Enabled" : "Disabled"}
      </StatusCell>
    ),
  },
  {
    id: "last_login",
    label: "Last Login",
    menuLabel: "Last Login",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 180,
    minWidth: 100,
    renderCell: (user) => <DateTimeCell value={user.last_login_at} fallback="Never" className="text-[var(--muted-foreground)]" />,
    cellClassName: "text-[var(--muted-foreground)]",
  },
  {
    id: "created",
    label: "Created",
    menuLabel: "Created",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 180,
    minWidth: 100,
    renderCell: (user) => <DateTimeCell value={user.created_at} className="text-[var(--muted-foreground)]" />,
    cellClassName: "text-[var(--muted-foreground)]",
  },
  {
    id: "updated",
    label: "Updated",
    menuLabel: "Updated",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 180,
    minWidth: 100,
    renderCell: (user) => <DateTimeCell value={user.updated_at} className="text-[var(--muted-foreground)]" />,
    cellClassName: "text-[var(--muted-foreground)]",
  },
];

type UsersTabProps = Readonly<{
  deletingUserId: string | null;
  isRenamingUser: boolean;
  isUpdatingStatusUserId: string | null;
  isUsersLoading: boolean;
  onAddUser: () => void;
  onCancelRename: () => void;
  onDeleteUser: (userId: string) => void;
  onOpenUserDetails: (user: UserDto) => void;
  onOpenResetPassword: (user: UserDto) => void;
  onRenameInputChange: (value: string) => void;
  onStartRename: (user: UserDto) => void;
  onSubmitRename: (user: UserDto) => void | Promise<void>;
  onToggleUserEnabled: (user: UserDto) => void;
  onToggleSelectedUser: (userId: string) => void;
  renamingUserId: string | null;
  renameUserName: string;
  selectedUserId: string | null;
  setUserMenuOpen: (userId: string | null) => void;
  sorting: UnifiedTableSorting<UserColumn>;
  userMenuOpen: string | null;
  users: UserDto[];
  usersError: string | null;
  onSortingChange: (sorting: UnifiedTableSorting<UserColumn>) => void;
}>;

export function UsersTab({
  deletingUserId,
  isRenamingUser,
  isUpdatingStatusUserId,
  isUsersLoading,
  onAddUser,
  onCancelRename,
  onDeleteUser,
  onOpenUserDetails,
  onOpenResetPassword,
  onRenameInputChange,
  onStartRename,
  onSubmitRename,
  onToggleUserEnabled,
  onToggleSelectedUser,
  renamingUserId,
  renameUserName,
  selectedUserId,
  setUserMenuOpen,
  sorting,
  userMenuOpen,
  users,
  usersError,
  onSortingChange,
}: UsersTabProps) {
  // Local filters and column visibility
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<UserStatusFilter>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<UserColumn>>(
    new Set(["user", "email", "team", "projects", "status", "last_login"])
  );

  // Column toggle
  const toggleColumn = (column: UserColumn) => {
    const next = new Set(visibleColumns);
    if (next.has(column)) {
      next.delete(column);
    } else {
      next.add(column);
    }
    setVisibleColumns(next);
  };

  // Filter toggles
  const toggleStatusFilter = (status: UserStatusFilter) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const toggleTeamFilter = (team: string) => {
    setSelectedTeams((current) => {
      const next = new Set(current);
      if (next.has(team)) {
        next.delete(team);
      } else {
        next.add(team);
      }
      return next;
    });
  };

  // Derived: team filter options and filtered rows
  const teamOptions = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.team?.trim() ?? "").filter((team) => team.length > 0))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const fullName = getFullName(user);
      const team = user.team?.trim() ?? "";
      const matchesSearch =
        query.length === 0 ||
        user.username.toLowerCase().includes(query) ||
        fullName.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query) ||
        team.toLowerCase().includes(query);

      const matchesStatus =
        selectedStatuses.size === 0 ||
        (selectedStatuses.has("enabled") && user.is_enabled) ||
        (selectedStatuses.has("disabled") && !user.is_enabled);

      const matchesTeam = selectedTeams.size === 0 || selectedTeams.has(team);

      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [searchQuery, selectedStatuses, selectedTeams, users]);

  const activeFiltersCount = selectedStatuses.size + selectedTeams.size;

  return (
    <EntityListPage
      title={<span className="text-xl">Users & Teams</span>}
      subtitle="Manage workspace users"
      actions={
        <Button unstyled
          className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
          onClick={onAddUser}
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      }
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder="Search users by name, username, email, ID..."
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      activeFiltersCount={activeFiltersCount}
      onClearFilters={() => {
        setSelectedStatuses(new Set());
        setSelectedTeams(new Set());
      }}
      filtersContent={
        <>
          <FilterChecklistSection
            title="Status"
            values={["enabled", "disabled"]}
            selectedValues={selectedStatuses}
            onToggle={(value) => toggleStatusFilter(value as UserStatusFilter)}
            getLabel={(value) => (value === "enabled" ? "Enabled" : "Disabled")}
          />
          <FilterChecklistSection
            title="Team"
            values={teamOptions}
            selectedValues={selectedTeams}
            onToggle={toggleTeamFilter}
            emptyLabel="No teams found"
            maxHeightClassName="max-h-40 overflow-y-auto pr-1"
          />
        </>
      }
      isLoading={isUsersLoading}
      error={usersError}
      empty={filteredUsers.length === 0}
      colSpan={visibleColumns.size + 1}
      loadingMessage="Loading users..."
      emptyMessage="No users found"
    >
      {/* Table with optional inline rename */}
      <UnifiedTable
            className="p-0"
            items={filteredUsers}
            visibleColumns={visibleColumns}
            columns={USER_COLUMNS.map<UnifiedTableColumn<UserDto, UserColumn>>((column) =>
              column.id === "user"
                ? {
                    ...column,
                    renderCell: (user: UserDto) =>
                      renamingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameUserName}
                            onChange={(event) => onRenameInputChange(event.target.value)}
                            className="w-44 rounded border border-[var(--border)] px-2 py-1 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                            autoFocus
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") {
                                event.preventDefault();
                                invokeMaybeAsync(() => onSubmitRename(user));
                                return;
                              }
                              if (event.key === "Escape") {
                                onCancelRename();
                              }
                            }}
                          />
                          <Button unstyled
                            className="rounded bg-[var(--action-primary-fill)] px-2 py-1 text-xs font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-50"
                            onClick={(event) => {
                              event.stopPropagation();
                              invokeMaybeAsync(() => onSubmitRename(user));
                            }}
                            disabled={isRenamingUser || !renameUserName.trim()}
                          >
                            Save
                          </Button>
                          <Button unstyled
                            className="rounded border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCancelRename();
                            }}
                            disabled={isRenamingUser}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        column.renderCell(user)
                      ),
                  }
                : column
            )}
            getRowId={(user) => user.id}
            columnsMenu={{
              open: columnsOpen,
              onOpenChange: setColumnsOpen,
              onToggleColumn: toggleColumn,
            }}
            sorting={{
              value: sorting,
              onChange: onSortingChange,
            }}
            onRowClick={(user) => {
              if (renamingUserId === user.id) return;
              if (selectedUserId === user.id) {
                onToggleSelectedUser(user.id);
                return;
              }
              onOpenUserDetails(user);
            }}
            rowClassName={(user) => (selectedUserId === user.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined)}
            actions={{
              render: (user) => (
                <RowActionsMenu
                  open={userMenuOpen === user.id}
                  onOpenChange={(open) => setUserMenuOpen(open ? user.id : null)}
                  items={[
                    {
                      key: "rename",
                      label: "Rename Username",
                      disabled: isRenamingUser,
                      onSelect: () => onStartRename(user),
                    },
                    {
                      key: "reset_password",
                      label: "Reset Password",
                      onSelect: () => onOpenResetPassword(user),
                    },
                    {
                      key: "toggle_enabled",
                      label: user.is_enabled ? "Disable" : "Enable",
                      variant: user.is_enabled ? "destructive" : "default",
                      disabled: isUpdatingStatusUserId === user.id,
                      onSelect: () => onToggleUserEnabled(user),
                    },
                    {
                      key: "delete",
                      label: "Delete",
                      variant: "destructive",
                      disabled: deletingUserId === user.id,
                      onSelect: () => onDeleteUser(user.id),
                    },
                  ]}
                />
              ),
          }}
        />
    </EntityListPage>
  );
}
