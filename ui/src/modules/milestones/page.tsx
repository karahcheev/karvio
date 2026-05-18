import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Edit, Plus, Trash2 } from "lucide-react";
import {
  type MilestoneDto,
  type MilestoneStatus,
  useCreateMilestoneMutation,
  useDeleteMilestoneMutation,
  useMilestoneSummaryQuery,
  useMilestonesPageQuery,
  usePatchMilestoneMutation,
  useProjectMembersQuery,
} from "@/shared/api";
import {
  Button,
  CommonPage,
  EntityListPage,
  FilterChecklistSection,
  ListPageEmptyState,
  SelectField,
  SidePanel,
  SidePanelCard,
  SidePanelMetaRow,
  SidePanelSection,
  SidePanelStat,
  SidePanelStatGrid,
  TextareaField,
  TextField,
  UnderlineTabs,
} from "@/shared/ui";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { RowActionsMenu } from "@/shared/ui/RowActionsMenu";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { DateTimeCell, StatusCell } from "@/shared/ui/table-cells";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";

const STATUS_VALUES: MilestoneStatus[] = ["planned", "active", "completed", "archived"];

function statusLabel(status: MilestoneStatus): string {
  if (status === "planned") return "Planned";
  if (status === "active") return "Active";
  if (status === "completed") return "Completed";
  return "Archived";
}

function statusTone(status: MilestoneStatus): "neutral" | "info" | "success" | "warning" {
  if (status === "active") return "info";
  if (status === "completed") return "success";
  if (status === "archived") return "warning";
  return "neutral";
}

type MilestoneFormState = {
  name: string;
  description: string;
  status: MilestoneStatus;
  startDate: string;
  targetDate: string;
  releaseLabel: string;
  ownerId: string;
};

type MilestoneColumn = "name" | "status" | "target" | "release" | "created";

const EMPTY_FORM: MilestoneFormState = {
  name: "",
  description: "",
  status: "planned",
  startDate: "",
  targetDate: "",
  releaseLabel: "",
  ownerId: "",
};

function toFormState(milestone: MilestoneDto | null): MilestoneFormState {
  if (!milestone) return EMPTY_FORM;
  return {
    name: milestone.name,
    description: milestone.description ?? "",
    status: milestone.status,
    startDate: milestone.start_date ?? "",
    targetDate: milestone.target_date ?? "",
    releaseLabel: milestone.release_label ?? "",
    ownerId: milestone.owner_id ?? "",
  };
}

export function MilestonesModulePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { confirmDelete } = useDeleteConfirmation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<MilestoneStatus>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<MilestoneColumn>>(
    () => new Set<MilestoneColumn>(["name", "status", "target", "release", "created"]),
  );
  const [form, setForm] = useState<MilestoneFormState>(EMPTY_FORM);

  const listParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      search: searchQuery.trim() || undefined,
      statuses: selectedStatuses.size > 0 ? Array.from(selectedStatuses) : undefined,
    }),
    [currentPage, pageSize, searchQuery, selectedStatuses],
  );

  const milestonesQuery = useMilestonesPageQuery(projectId, listParams, Boolean(projectId));
  const membersQuery = useProjectMembersQuery(projectId);
  const createMutation = useCreateMilestoneMutation();
  const patchMutation = usePatchMilestoneMutation();
  const deleteMutation = useDeleteMilestoneMutation();

  const milestones = milestonesQuery.data?.items ?? [];
  const selectedMilestone = milestones.find((item) => item.id === selectedMilestoneId) ?? null;
  const summaryQuery = useMilestoneSummaryQuery(selectedMilestone?.id, Boolean(selectedMilestone));

  const ownerLabelById = new Map((membersQuery.data ?? []).map((member) => [member.user_id, member.username ?? "Unknown"]));

  const totalItems = milestonesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const ownerOptions = Array.from(ownerLabelById.entries()).map(([id, label]) => ({ id, label }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingMilestone(null);
    setCreateOpen(true);
  };

  const openEdit = (milestone: MilestoneDto) => {
    setForm(toFormState(milestone));
    setEditingMilestone(milestone);
    setCreateOpen(true);
  };

  const closeForm = () => {
    if (createMutation.isPending || patchMutation.isPending) return;
    setCreateOpen(false);
    setEditingMilestone(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!projectId || !form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      start_date: form.startDate || null,
      target_date: form.targetDate || null,
      owner_id: form.ownerId || null,
      release_label: form.releaseLabel.trim() || null,
    };
    try {
      if (editingMilestone) {
        await patchMutation.mutateAsync({ milestoneId: editingMilestone.id, payload });
        notifySuccess("Milestone updated");
      } else {
        await createMutation.mutateAsync({ project_id: projectId, ...payload });
        notifySuccess("Milestone created");
      }
      closeForm();
    } catch (error) {
      notifyError(error, editingMilestone ? "Failed to update milestone." : "Failed to create milestone.");
    }
  };

  const handleDelete = async (milestone: MilestoneDto) => {
    if (!projectId) return;
    const confirmed = await confirmDelete({
      title: "Delete Milestone",
      description: `Delete milestone "${milestone.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Milestone",
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync({ milestoneId: milestone.id, projectId });
      notifySuccess("Milestone deleted");
      if (selectedMilestoneId === milestone.id) setSelectedMilestoneId(null);
    } catch (error) {
      notifyError(error, "Failed to delete milestone.");
    }
  };

  const columns: UnifiedTableColumn<MilestoneDto, MilestoneColumn>[] = [
    {
      id: "name",
      label: "Milestone",
      menuLabel: "Milestone",
      defaultWidth: 260,
      minWidth: 180,
      locked: true,
      renderCell: (item) => (
        <Link
          to={`/projects/${projectId}/products/milestones/${item.id}`}
          className="font-medium text-[var(--highlight-foreground)] hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {item.name}
        </Link>
      ),
    },
    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (item) => <StatusCell tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusCell>,
    },
    {
      id: "target",
      label: "Target Date",
      menuLabel: "Target Date",
      defaultWidth: 130,
      minWidth: 110,
      renderCell: (item) => <span className="text-sm text-[var(--foreground)]">{item.target_date ?? "-"}</span>,
    },
    {
      id: "release",
      label: "Release",
      menuLabel: "Release",
      defaultWidth: 150,
      minWidth: 110,
      renderCell: (item) => <span className="text-sm text-[var(--foreground)]">{item.release_label ?? "-"}</span>,
    },
    {
      id: "created",
      label: "Created",
      menuLabel: "Created",
      defaultWidth: 220,
      minWidth: 180,
      renderCell: (item) => <DateTimeCell value={item.created_at} fallback="-" truncate={false} />,
    },
  ];

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">Milestones</span>}
        subtitle={
          <div className="space-y-3">
            <div>Release-level containers for plans, runs and execution progress</div>
            <UnderlineTabs<"products" | "components" | "milestones" | "test-plans">
              value="milestones"
              onChange={(next) => {
                if (!projectId) return;
                if (next === "products") {
                  navigate(`/projects/${projectId}/products`);
                  return;
                }
                if (next === "components") {
                  navigate(`/projects/${projectId}/products?tab=components`);
                  return;
                }
                if (next === "test-plans") {
                  navigate(`/projects/${projectId}/products/test-plans`);
                  return;
                }
              }}
              items={[
                { value: "products", label: "Products" },
                { value: "components", label: "Components" },
                { value: "milestones", label: "Milestones" },
                { value: "test-plans", label: "Test Plans" },
              ]}
            />
          </div>
        }
        actions={
          <Button
            unstyled
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
          >
            <Plus className="h-4 w-4" />
            New milestone
          </Button>
        }
        searchQuery={searchQuery}
        onSearchQueryChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search milestones by name, description, release..."
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={selectedStatuses.size}
        onClearFilters={() => {
          setSelectedStatuses(new Set());
          setFiltersOpen(false);
          setCurrentPage(1);
        }}
        panelClassName="w-72"
        filtersContent={
          <FilterChecklistSection
            title="Status"
            values={STATUS_VALUES}
            selectedValues={selectedStatuses}
            onToggle={(status) => {
              setSelectedStatuses((current) => {
                const next = new Set(current);
                if (next.has(status as MilestoneStatus)) next.delete(status as MilestoneStatus);
                else next.add(status as MilestoneStatus);
                return next;
              });
              setCurrentPage(1);
            }}
            getLabel={(status) => statusLabel(status as MilestoneStatus)}
          />
        }
        isLoading={milestonesQuery.isPending}
        error={null}
        empty={milestones.length === 0}
        colSpan={columns.length + 1}
        loadingMessage="Loading milestones..."
        emptyMessage={
          <ListPageEmptyState
            title="No milestones yet"
            description="Create milestones to organize release testing scope and execution progress."
            actions={
              <Button
                unstyled
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
              >
                <Plus className="h-4 w-4" />
                Create first milestone
              </Button>
            }
          />
        }
      >
        <UnifiedTable
          className="p-0"
          items={milestones}
          columns={columns}
          visibleColumns={visibleColumns}
          getRowId={(item) => item.id}
          onRowClick={(item) => {
            setOpenActionsId(null);
            setSelectedMilestoneId((current) => (current === item.id ? null : item.id));
          }}
          rowClassName={(item) => (selectedMilestoneId === item.id ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]" : undefined)}
          columnsMenu={{
            open: columnsOpen,
            onOpenChange: setColumnsOpen,
            onToggleColumn: (column) => {
              setVisibleColumns((current) => {
                const next = new Set(current);
                if (next.has(column)) next.delete(column);
                else next.add(column);
                return next;
              });
            },
          }}
          actions={{
            render: (item) => (
              <RowActionsMenu
                open={openActionsId === item.id}
                onOpenChange={(open) => setOpenActionsId(open ? item.id : null)}
                triggerLabel={`Actions for ${item.name}`}
                contentClassName="w-52"
                items={[
                  {
                    key: "edit",
                    label: "Edit",
                    icon: <Edit className="h-4 w-4" />,
                    onSelect: () => openEdit(item),
                  },
                  {
                    key: "delete",
                    label: "Delete",
                    icon: <Trash2 className="h-4 w-4" />,
                    onSelect: () => void handleDelete(item),
                    variant: "destructive",
                  },
                ]}
              />
            ),
          }}
          pagination={{
            enabled: true,
            mode: "server",
            page: currentPage,
            totalPages,
            totalItems,
            pageSize,
            pageSizeOptions: [10, 25, 50],
            defaultPageSize: pageSize,
            onPageChange: (page) => setCurrentPage(page),
            onPageSizeChange: (nextSize) => {
              setPageSize(nextSize);
              setCurrentPage(1);
            },
          }}
        />
      </EntityListPage>

      <AppModal isOpen={createOpen} onClose={closeForm} contentClassName="max-w-xl rounded-xl">
        <StandardModalLayout
          title={editingMilestone ? "Edit Milestone" : "New Milestone"}
          onClose={closeForm}
          closeButtonDisabled={createMutation.isPending || patchMutation.isPending}
          footer={
            <>
              <Button
                unstyled
                onClick={closeForm}
                disabled={createMutation.isPending || patchMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
              >
                Cancel
              </Button>
              <Button
                unstyled
                onClick={handleSubmit}
                disabled={!form.name.trim() || createMutation.isPending || patchMutation.isPending}
                className="rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:opacity-60"
              >
                {createMutation.isPending || patchMutation.isPending ? "Saving..." : editingMilestone ? "Save" : "Create"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <TextField
              label="Name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g., Release 2.4"
              autoFocus
            />
            <TextareaField
              label="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional release scope notes"
              rows={3}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MilestoneStatus }))}
            >
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </SelectField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]" htmlFor="milestone-start-date">
                  Start date
                </label>
                <input
                  id="milestone-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]" htmlFor="milestone-target-date">
                  Target date
                </label>
                <input
                  id="milestone-target-date"
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
                  className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
                />
              </div>
            </div>
            <TextField
              label="Release label"
              value={form.releaseLabel}
              onChange={(event) => setForm((current) => ({ ...current, releaseLabel: event.target.value }))}
              placeholder="e.g., v2.4.0"
            />
            <SelectField
              label="Owner"
              value={form.ownerId}
              onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value }))}
            >
              <option value="">No owner</option>
              {ownerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
        </StandardModalLayout>
      </AppModal>

      {selectedMilestone ? (
        <SidePanel
          title={selectedMilestone.name}
          subtitle={<span className="text-sm text-[var(--muted-foreground)]">{selectedMilestone.description || "No description"}</span>}
          onClose={() => setSelectedMilestoneId(null)}
          actions={
            <>
              <Button unstyled onClick={() => openEdit(selectedMilestone)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]">
                Edit
              </Button>
              <Button
                unstyled
                onClick={() => void handleDelete(selectedMilestone)}
                className="rounded-md border border-[var(--tone-danger-border)] px-3 py-1.5 text-xs text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)]"
              >
                Delete
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <SidePanelSection title="Summary">
              <SidePanelStatGrid className="grid-cols-2">
                <SidePanelStat label="Plans" value={summaryQuery.data?.plans_total ?? 0} />
                <SidePanelStat label="Runs" value={summaryQuery.data?.runs_total ?? 0} />
                <SidePanelStat label="Pass rate" value={`${summaryQuery.data?.pass_rate ?? 0}%`} />
                <SidePanelStat label="Overdue" value={summaryQuery.data?.overdue ? "Yes" : "No"} />
              </SidePanelStatGrid>
            </SidePanelSection>

            <SidePanelSection title="Run status">
              <SidePanelCard>
                <SidePanelMetaRow label="Planned" value={summaryQuery.data?.planned_runs ?? 0} />
                <SidePanelMetaRow label="Active" value={summaryQuery.data?.active_runs ?? 0} />
                <SidePanelMetaRow label="Completed" value={summaryQuery.data?.completed_runs ?? 0} />
                <SidePanelMetaRow label="Archived" value={summaryQuery.data?.archived_runs ?? 0} />
              </SidePanelCard>
            </SidePanelSection>

            <SidePanelSection title="Metadata">
              <SidePanelCard>
                <SidePanelMetaRow label="Status" value={statusLabel(selectedMilestone.status)} />
                <SidePanelMetaRow label="Start date" value={selectedMilestone.start_date ?? "-"} />
                <SidePanelMetaRow label="Target date" value={selectedMilestone.target_date ?? "-"} />
                <SidePanelMetaRow label="Release" value={selectedMilestone.release_label ?? "-"} />
                <SidePanelMetaRow label="Owner" value={ownerLabelById.get(selectedMilestone.owner_id ?? "") ?? "-"} />
                <SidePanelMetaRow label="Created" value={<DateTimeCell value={selectedMilestone.created_at} fallback="-" truncate={false} />} />
              </SidePanelCard>
            </SidePanelSection>
          </div>
        </SidePanel>
      ) : null}
    </CommonPage>
  );
}
