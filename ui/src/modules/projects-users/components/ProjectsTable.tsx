// Projects table: links to detail and destructive row action.
import { Link } from "react-router";
import type { ProjectDto } from "@/shared/api";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn, type UnifiedTableSorting } from "@/shared/ui/Table";
import { DateTimeCell, IdCell } from "@/shared/ui/table-cells";

export type ProjectColumn = "project" | "id" | "members" | "created";
type ProjectTableRow = ProjectDto & { membersCount: number };

type ProjectsTableProps = Readonly<{
  items: ProjectTableRow[];
  visibleColumns: Set<ProjectColumn>;
  sorting: UnifiedTableSorting<ProjectColumn>;
  selectedProjectId: string | null;
  projectMenuOpen: string | null;
  deletingProjectId: string | null;
  columnsOpen: boolean;
  onSortingChange: (sorting: UnifiedTableSorting<ProjectColumn>) => void;
  onRowClick: (project: ProjectTableRow) => void;
  setProjectMenuOpen: (projectId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleColumn: (column: ProjectColumn) => void;
  onColumnsOpenChange: (open: boolean) => void;
}>;

// Static column config
const COLUMNS: UnifiedTableColumn<ProjectTableRow, ProjectColumn>[] = [
  {
    id: "project",
    label: "Project",
    menuLabel: "Project",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 320,
    minWidth: 120,
    renderCell: (project) => (
      <Link
        to={`/projects/${project.id}/details`}
        className="block truncate font-medium text-[var(--highlight-foreground)] hover:text-[var(--highlight-foreground)] hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {project.name}
      </Link>
    ),
  },
  {
    id: "id",
    label: "ID",
    menuLabel: "ID",
    sortable: true,
    defaultSortDirection: "asc",
    defaultWidth: 190,
    minWidth: 72,
    renderCell: (project) => <IdCell value={project.id} />,
    cellClassName: "font-mono text-xs text-[var(--muted-foreground)]",
  },
  {
    id: "members",
    label: "Members",
    menuLabel: "Members",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 96,
    minWidth: 56,
    renderCell: (project) => project.membersCount,
    cellClassName: "text-[var(--foreground)]",
  },
  {
    id: "created",
    label: "Created",
    menuLabel: "Created",
    sortable: true,
    defaultSortDirection: "desc",
    defaultWidth: 180,
    minWidth: 100,
    renderCell: (project) => <DateTimeCell value={project.created_at} className="text-[var(--muted-foreground)]" />,
    cellClassName: "text-[var(--muted-foreground)]",
  },
];

export function ProjectsTable({
  items,
  visibleColumns,
  sorting,
  selectedProjectId,
  projectMenuOpen,
  deletingProjectId,
  columnsOpen,
  onSortingChange,
  onRowClick,
  setProjectMenuOpen,
  onDeleteProject,
  onToggleColumn,
  onColumnsOpenChange,
}: ProjectsTableProps) {
  return (
    <UnifiedTable
      className="p-0"
      items={items}
      visibleColumns={visibleColumns}
      columns={COLUMNS}
      getRowId={(project) => project.id}
      onRowClick={onRowClick}
      rowClassName={(project) =>
        selectedProjectId === project.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined
      }
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
        render: (project) => (
          <RowActionsMenu
            open={projectMenuOpen === project.id}
            onOpenChange={(open) => setProjectMenuOpen(open ? project.id : null)}
            items={[
              { key: "open", label: "Open", to: `/projects/${project.id}/details` },
              { key: "edit", label: "Edit", to: `/projects/${project.id}/details` },
              { key: "assign-members", label: "Assign Members", to: `/projects/${project.id}/details#members` },
              {
                key: "delete",
                label: "Delete",
                variant: "destructive",
                disabled: deletingProjectId === project.id,
                onSelect: () => onDeleteProject(project.id),
              },
            ]}
          />
        ),
      }}
    />
  );
}
