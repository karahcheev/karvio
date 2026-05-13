// Audit log page: searchable list, filters, and detail side panel.
import { EntityListPage } from "@/shared/ui/EntityListPage";
import { Button } from "@/shared/ui/Button";
import { AuditLogDetailsPanel } from "./components/AuditLogDetailsPanel";
import { AuditLogsFilters } from "./components/AuditLogsFilters";
import { AuditLogsTable } from "./components/AuditLogsTable";
import { useAuditLogsPage } from "./hooks/use-audit-logs-page";

export function AuditLogsModulePage() {
  const model = useAuditLogsPage();

  return (
    <>
      {/* List + toolbar */}
      <EntityListPage
        title={<span className="text-xl">Audit Log</span>}
        subtitle="Track all critical system actions"
        actions={
          <Button
            unstyled
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            onClick={() => void model.actions.loadLogs("replace")}
            disabled={model.state.isLoading}
          >
            {model.state.isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        }
        searchQuery={model.state.searchQuery}
        onSearchQueryChange={model.actions.setSearchQuery}
        searchPlaceholder="Search by action, actor, resource, request ID..."
        filtersOpen={model.state.filtersOpen}
        onFiltersOpenChange={model.actions.setFiltersOpen}
        activeFiltersCount={model.data.activeFiltersCount}
        onClearFilters={model.actions.handleClearFilters}
        filtersContent={
          <AuditLogsFilters
            draftFilters={model.state.draftFilters}
            onDraftFiltersChange={model.actions.setDraftFilters}
            actorOptions={model.data.actorOptions}
            onApply={model.actions.handleApplyFilters}
            onReset={model.actions.handleClearFilters}
          />
        }
        isLoading={model.state.isLoading}
        error={model.state.error}
        empty={model.data.tableRows.length === 0}
        colSpan={model.state.visibleColumns.size + 1}
        loadingMessage="Loading audit logs..."
        emptyMessage="No audit records found"
        panelClassName="w-[26rem]"
      >
        <AuditLogsTable
          items={model.data.tableRows}
          visibleColumns={model.state.visibleColumns}
          columnsOpen={model.state.columnsOpen}
          selectedLogEventId={model.state.selectedLogEventId}
          sorting={model.state.sorting}
          onColumnsOpenChange={model.actions.setColumnsOpen}
          onSortingChange={model.actions.setSorting}
          onToggleColumn={model.actions.toggleColumn}
          onRowClick={(item) => model.actions.setSelectedLogEventId(item.event_id)}
        />
      </EntityListPage>

      {/* Selected entry */}
      {model.data.selectedLog ? (
        <AuditLogDetailsPanel
          log={model.data.selectedLog}
          onClose={() => model.actions.setSelectedLogEventId(null)}
        />
      ) : null}
    </>
  );
}
