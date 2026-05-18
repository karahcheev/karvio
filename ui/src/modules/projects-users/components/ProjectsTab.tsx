// Projects tab: local filters and sortable project table.
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ProjectDto } from "@/shared/api";
import { EntityListPage } from "@/shared/ui/EntityListPage";
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import { Button } from "@/shared/ui/Button";
import { ProjectsTable, type ProjectColumn } from "./ProjectsTable";

type ProjectMemberFilter = "with_members" | "without_members";
type ProjectTableRow = ProjectDto & { membersCount: number };

type ProjectsTabProps = Readonly<{
  deletingProjectId: string | null;
  isLoading: boolean;
  onDeleteProject: (projectId: string) => void;
  onOpenCreate: () => void;
  onOpenDetails: (projectId: string) => void;
  onToggleProject: (projectId: string) => void;
  projectMenuOpen: string | null;
  projects: ProjectDto[];
  selectedProjectId: string | null;
  setProjectMenuOpen: (projectId: string | null) => void;
  sorting: UnifiedTableSorting<ProjectColumn>;
  onSortingChange: (sorting: UnifiedTableSorting<ProjectColumn>) => void;
}>;

export function ProjectsTab({
  deletingProjectId,
  isLoading,
  onDeleteProject,
  onOpenCreate,
  onOpenDetails,
  onToggleProject,
  projectMenuOpen,
  projects,
  selectedProjectId,
  setProjectMenuOpen,
  sorting,
  onSortingChange,
}: ProjectsTabProps) {
  // Local list UI state
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberFilters, setSelectedMemberFilters] = useState<Set<ProjectMemberFilter>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<ProjectColumn>>(
    new Set(["project", "id", "members", "created"])
  );

  // Column visibility
  const toggleColumn = (column: ProjectColumn) => {
    const next = new Set(visibleColumns);
    if (next.has(column)) {
      next.delete(column);
    } else {
      next.add(column);
    }
    setVisibleColumns(next);
  };

  const toggleMemberFilter = (filter: ProjectMemberFilter) => {
    setSelectedMemberFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  // Rows with derived member count
  const rows: ProjectTableRow[] = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        membersCount: project.members_count,
      })),
    [projects]
  );

  // Client-side search and member-presence filters
  const filteredRows: ProjectTableRow[] = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rows.filter((project) => {
      const matchesSearch =
        query.length === 0 ||
        project.name.toLowerCase().includes(query) ||
        project.id.toLowerCase().includes(query);

      const hasMembers = project.membersCount > 0;
      const matchesMemberFilter =
        selectedMemberFilters.size === 0 ||
        (selectedMemberFilters.has("with_members") && hasMembers) ||
        (selectedMemberFilters.has("without_members") && !hasMembers);

      return matchesSearch && matchesMemberFilter;
    });
  }, [rows, searchQuery, selectedMemberFilters]);

  const activeFiltersCount = selectedMemberFilters.size;

  return (
    <EntityListPage
      title={<span className="text-xl">Projects</span>}
      subtitle="Manage all workspace projects"
      actions={
        <Button unstyled
          className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
          onClick={onOpenCreate}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      }
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder="Search projects by name or ID..."
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      activeFiltersCount={activeFiltersCount}
      onClearFilters={() => setSelectedMemberFilters(new Set())}
      panelClassName="w-72"
      filtersContent={
        <FilterChecklistSection
          title="Members"
          values={["with_members", "without_members"]}
          selectedValues={selectedMemberFilters}
          onToggle={(value) => toggleMemberFilter(value as ProjectMemberFilter)}
          getLabel={(value) => (value === "with_members" ? "With members" : "Without members")}
        />
      }
      isLoading={isLoading}
      error={null}
      empty={filteredRows.length === 0}
      colSpan={visibleColumns.size + 1}
      loadingMessage="Loading projects..."
      emptyMessage="No projects found"
    >
        {/* Project table */}
        <ProjectsTable
            items={filteredRows}
            visibleColumns={visibleColumns}
            sorting={sorting}
            selectedProjectId={selectedProjectId}
            projectMenuOpen={projectMenuOpen}
            deletingProjectId={deletingProjectId}
            columnsOpen={columnsOpen}
            onSortingChange={onSortingChange}
            onRowClick={(project) => {
              onOpenDetails(project.id);
              onToggleProject(project.id);
            }}
            setProjectMenuOpen={setProjectMenuOpen}
            onDeleteProject={onDeleteProject}
            onToggleColumn={toggleColumn}
            onColumnsOpenChange={setColumnsOpen}
          />
    </EntityListPage>
  );
}
