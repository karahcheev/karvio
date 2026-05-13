// Project members table with role changes and remove.
import { Plus, Trash2, Users } from "lucide-react";
import type { ProjectMemberDto, ProjectMemberRole } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { EntityTableWithStates } from "@/shared/ui/EntityTableWithStates";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableSorting } from "@/shared/ui/Table";
import { Button } from "@/shared/ui/Button";
import { DateTimeCell } from "@/shared/ui/table-cells";

const MEMBER_ROLES: ProjectMemberRole[] = ["viewer", "tester", "lead", "manager"];
type MemberColumn = "user" | "role" | "added";
type MemberRow = ProjectMemberDto & { username: string };

type ProjectMembersTableProps = Readonly<{
  members: MemberRow[];
  isLoading: boolean;
  error: string | null;
  isUsersLoading: boolean;
  availableUsersCount: number | undefined;
  memberActionError: string | null;
  visibleColumns: Set<MemberColumn>;
  columnsOpen: boolean;
  sorting: UnifiedTableSorting<MemberColumn>;
  updatingMemberId: string | null;
  deletingMemberId: string | null;
  onAddMember: () => void;
  onRoleChange: (memberId: string, role: ProjectMemberRole) => void;
  onDeleteMember: (memberId: string) => void;
  onToggleColumn: (column: MemberColumn) => void;
  onColumnsOpenChange: (open: boolean) => void;
  onSortingChange: (sorting: UnifiedTableSorting<MemberColumn>) => void;
}>;

export function ProjectMembersTable({
  members,
  isLoading,
  error,
  isUsersLoading,
  availableUsersCount,
  memberActionError,
  visibleColumns,
  columnsOpen,
  sorting,
  updatingMemberId,
  deletingMemberId,
  onAddMember,
  onRoleChange,
  onDeleteMember,
  onToggleColumn,
  onColumnsOpenChange,
  onSortingChange,
}: ProjectMembersTableProps) {
  // Column definitions
  const columns: UnifiedTableColumn<MemberRow, MemberColumn>[] = [
    {
      id: "user",
      label: "User",
      menuLabel: "User",
      sortable: true,
      defaultSortDirection: "asc",
      renderCell: (member) => (
        <div>
          <div className="font-medium">{member.username}</div>
        </div>
      ),
      cellClassName: "text-[var(--foreground)]",
    },
    {
      id: "role",
      label: "Role",
      menuLabel: "Role",
      sortable: true,
      defaultSortDirection: "asc",
      renderCell: (member) => (
        <select
          value={member.role}
          onChange={(event) =>
            invokeMaybeAsync(() => onRoleChange(member.id, event.target.value as ProjectMemberRole))
          }
          disabled={updatingMemberId === member.id || deletingMemberId === member.id}
          className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
        >
          {MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "added",
      label: "Added",
      menuLabel: "Added",
      sortable: true,
      defaultSortDirection: "desc",
      renderCell: (member) => <DateTimeCell value={member.created_at} className="text-[var(--muted-foreground)]" />,
      cellClassName: "text-[var(--muted-foreground)]",
    },
  ];

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Project Members</h2>
        </div>
        <Button unstyled
          onClick={onAddMember}
          disabled={isUsersLoading || (availableUsersCount !== undefined && availableUsersCount === 0)}
          className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <p className="mb-6 text-sm text-[var(--muted-foreground)]">Assign users to this project and manage their roles.</p>

      {isUsersLoading && <p className="mb-3 text-xs text-[var(--muted-foreground)]">Loading users...</p>}
      {!isUsersLoading && availableUsersCount !== undefined && availableUsersCount === 0 && (
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">All workspace users are already members of this project.</p>
      )}

      {memberActionError && <p className="mb-3 text-sm text-[var(--status-failure)]">{memberActionError}</p>}

      <EntityTableWithStates
        isLoading={isLoading}
        error={error}
        empty={members.length === 0}
        colSpan={visibleColumns.size + 1}
        loadingMessage="Loading members..."
        emptyMessage="No members in this project yet."
      >
        <UnifiedTable
          className="p-0"
          items={members}
          columns={columns}
          visibleColumns={visibleColumns}
          getRowId={(member) => member.id}
          columnsMenu={{
            open: columnsOpen,
            onOpenChange: onColumnsOpenChange,
            onToggleColumn: onToggleColumn,
          }}
          sorting={{
            value: sorting,
            onChange: onSortingChange,
          }}
          actions={{
            render: (member) => (
              <Button unstyled
                onClick={() => invokeMaybeAsync(() => onDeleteMember(member.id))}
                disabled={deletingMemberId === member.id || updatingMemberId === member.id}
                title="Remove member"
                aria-label="Remove member"
                className="rounded p-1.5 text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          }}
        />
      </EntityTableWithStates>
    </div>
  );
}
