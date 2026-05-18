// High-level data table: selection, sorting, pagination, column resize, and actions.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  StandardTable,
  StandardTableActionsCell,
  StandardTableActionsHeadCell,
  StandardTableCell,
  StandardTableHeader,
  StandardTableRow,
  StandardTableSelectionCell,
  StandardTableSelectionHeadCell,
} from "./base";
import { TableColumnsMenu } from "./column-visibility";
import { TablePagination } from "./pagination";
import { getVisibleSelectionState, syncIndeterminateCheckbox } from "./selection";
import { UnifiedHeadCell } from "./sortable-header";
import type { TableColumnOption, UnifiedTableColumn, UnifiedTableProps } from "./types";
import { useUnifiedTablePaginationState } from "./use-unified-table-pagination";
import { useUnifiedTableColumnResize } from "./use-unified-table-column-resize";

function stickyFirstHeadClass(stickyFirstColumn: boolean, hasSelection: boolean): string | undefined {
  if (!stickyFirstColumn) return undefined;
  return hasSelection
    ? "sticky left-[40px] z-[29] border-r border-[var(--border)] bg-[var(--table-header-surface)]"
    : "sticky left-0 z-[31] border-r border-[var(--border)] bg-[var(--table-header-surface)]";
}

function stickyFirstBodyCellClass(stickyFirstColumn: boolean, hasSelection: boolean): string | undefined {
  if (!stickyFirstColumn) return undefined;
  return hasSelection
    ? "sticky left-[40px] z-[19] border-r border-[var(--border)] bg-[var(--card)]"
    : "sticky left-0 z-20 border-r border-[var(--border)] bg-[var(--card)]";
}

type UnifiedTableCardProps<TItem, TColumn extends string> = Readonly<{
  actions?: UnifiedTableProps<TItem, TColumn>["actions"];
  bodyClassName?: string;
  columns: UnifiedTableColumn<TItem, TColumn>[];
  columnsMenu?: UnifiedTableProps<TItem, TColumn>["columnsMenu"];
  displayedColumns: UnifiedTableColumn<TItem, TColumn>[];
  displayedItems: TItem[];
  footer?: ReactNode;
  getColumnStyle: (column: UnifiedTableColumn<TItem, TColumn>) => CSSProperties | undefined;
  getRowId: (item: TItem) => string;
  handleResizeStart: (column: UnifiedTableColumn<TItem, TColumn>, event: PointerEvent<HTMLSpanElement>) => void;
  hasActionsColumn: boolean;
  isServerPagination: boolean;
  items: TItem[];
  onRowClick?: (item: TItem) => void;
  pagination?: UnifiedTableProps<TItem, TColumn>["pagination"];
  paginationEnabled: boolean;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  rowClassName?: string | ((item: TItem) => string | undefined);
  selectAllCheckboxRef: { readonly current: HTMLInputElement | null };
  selection?: UnifiedTableProps<TItem, TColumn>["selection"];
  selectionState: ReturnType<typeof getVisibleSelectionState>;
  setClientPage: (page: number) => void;
  setClientPageSize: (size: number) => void;
  sorting?: UnifiedTableProps<TItem, TColumn>["sorting"];
  stickyFirstCellClassName: string | undefined;
  stickyFirstColumn: boolean;
  stickyFirstHeadClassName: string | undefined;
  tableCardFlushTop?: boolean;
  tableClassName?: string;
  tableName?: string;
  totalPages: number;
  visibleColumnIds: Set<TColumn>;
  visibleRowIds: string[];
}>;

function UnifiedTableCard<TItem, TColumn extends string>({
  actions,
  bodyClassName,
  columns,
  columnsMenu,
  displayedColumns,
  displayedItems,
  footer,
  getColumnStyle,
  getRowId,
  handleResizeStart,
  hasActionsColumn,
  isServerPagination,
  items,
  onRowClick,
  pagination,
  paginationEnabled,
  page,
  pageSize,
  pageSizeOptions,
  rowClassName,
  selectAllCheckboxRef,
  selection,
  selectionState,
  setClientPage,
  setClientPageSize,
  sorting,
  stickyFirstCellClassName,
  stickyFirstColumn,
  stickyFirstHeadClassName,
  tableCardFlushTop,
  tableClassName,
  tableName,
  totalPages,
  visibleColumnIds,
  visibleRowIds,
}: UnifiedTableCardProps<TItem, TColumn>) {
  return (
    <div
      className={cn(
        "min-h-0 flex flex-1 flex-col overflow-hidden bg-[var(--card)]",
        tableCardFlushTop ? "rounded-b-lg border-0" : "rounded-lg border border-[var(--border)]",
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <StandardTable className={cn("min-w-full table-fixed", tableClassName)}>
          {tableName ? <caption className="sr-only">{tableName}</caption> : null}
          <StandardTableHeader>
            <tr>
              {selection ? (
                <StandardTableSelectionHeadCell>
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={selectionState.isAllVisibleRowsSelected}
                    onChange={(event) => selection.onToggleSelectAll(event.target.checked, visibleRowIds, displayedItems)}
                    className="h-4 w-4 rounded border-[var(--input)] text-[var(--primary)]"
                  />
                </StandardTableSelectionHeadCell>
              ) : null}
              {displayedColumns.map((column, index) => (
                <UnifiedHeadCell
                  key={column.id}
                  column={column}
                  className={cn(stickyFirstColumn && index === 0 && stickyFirstHeadClassName, selection && index === 0 && "pl-2")}
                  style={getColumnStyle(column)}
                  onResizeStart={handleResizeStart}
                  sorting={sorting}
                />
              ))}
              {hasActionsColumn ? (
                <StandardTableActionsHeadCell>
                  {columnsMenu ? (
                    <TableColumnsMenu
                      columns={columns.map((column) => ({
                        id: column.id,
                        label: column.menuLabel,
                        locked: column.locked,
                      }) satisfies TableColumnOption<TColumn>)}
                      visibleColumns={visibleColumnIds}
                      open={columnsMenu.open}
                      onOpenChange={columnsMenu.onOpenChange}
                      onToggleColumn={columnsMenu.onToggleColumn}
                      triggerClassName={columnsMenu.triggerClassName}
                      align={columnsMenu.align}
                    />
                  ) : (
                    actions?.headContent
                  )}
                </StandardTableActionsHeadCell>
              ) : null}
            </tr>
          </StandardTableHeader>
          <tbody className={cn("divide-y divide-border bg-[var(--card)]", bodyClassName)}>
            {displayedItems.map((item) => {
              const rowId = getRowId(item);

              return (
                <StandardTableRow
                  key={rowId}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={typeof rowClassName === "function" ? rowClassName(item) : rowClassName}
                >
                  {selection ? (
                    <StandardTableSelectionCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selection.selectedRowIds.has(rowId)}
                        disabled={selection.isRowSelectionDisabled?.(item) ?? false}
                        onChange={() => selection.onToggleRow(rowId)}
                        aria-label={selection.ariaLabel?.(item)}
                        className="h-4 w-4 rounded border-[var(--input)] text-[var(--primary)]"
                      />
                    </StandardTableSelectionCell>
                  ) : null}
                  {displayedColumns.map((column, index) => {
                    const extraStyle = typeof column.cellStyle === "function" ? column.cellStyle(item) : column.cellStyle;

                    return (
                      <StandardTableCell
                        key={column.id}
                        nowrap={column.nowrap ?? true}
                        className={cn(
                          stickyFirstColumn && index === 0 && stickyFirstCellClassName,
                          selection && index === 0 && "pl-2",
                          column.cellClassName,
                        )}
                        style={{ ...getColumnStyle(column), ...extraStyle }}
                        onClick={column.onCellClick ? (event) => {
                          column.onCellClick?.(event, item);
                        } : undefined}
                      >
                        {column.nowrap ?? true ? (
                          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{column.renderCell(item)}</div>
                        ) : (
                          column.renderCell(item)
                        )}
                      </StandardTableCell>
                    );
                  })}
                  {hasActionsColumn ? (
                    <StandardTableActionsCell
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.stopPropagation();
                        }
                      }}
                    >
                      <div className="flex items-center justify-center">{actions?.render(item) ?? null}</div>
                    </StandardTableActionsCell>
                  ) : null}
                </StandardTableRow>
              );
            })}
          </tbody>
        </StandardTable>
      </div>

      {paginationEnabled && items.length > 0 ? (
        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={isServerPagination ? pagination?.totalItems : items.length}
          totalPages={totalPages}
          onPageChange={isServerPagination ? (next) => pagination?.onPageChange?.(next) : setClientPage}
          onPageSizeChange={isServerPagination ? (next) => pagination?.onPageSizeChange?.(next) : setClientPageSize}
          currentPageItemCount={displayedItems.length}
        />
      ) : null}
      {footer}
    </div>
  );
}

export function UnifiedTable<TItem, TColumn extends string>({
  items,
  columns,
  visibleColumns,
  tableName,
  tableCardFlushTop,
  sectionCollapsible,
  sectionDefaultExpanded = true,
  stickyFirstColumn = false,
  className,
  tableClassName,
  bodyClassName,
  rowClassName,
  getRowId,
  onRowClick,
  selection,
  columnsMenu,
  actions,
  footer,
  pagination,
  sorting,
}: Readonly<UnifiedTableProps<TItem, TColumn>>) {
  const showSectionHeader = Boolean(tableName && sectionCollapsible);
  const sectionPanelId = useId();
  const [sectionExpanded, setSectionExpanded] = useState(sectionDefaultExpanded);

  // Layout flags

  const hasActionsColumn = Boolean(actions || columnsMenu);
  const paginationEnabled = pagination?.enabled ?? true;
  const {
    isServerPagination,
    pageSizeOptions,
    pageSize,
    page,
    totalPages,
    displayedItems,
    setClientPage,
    setClientPageSize,
  } = useUnifiedTablePaginationState(items, pagination, paginationEnabled);

  // Row selection and header checkbox

  const visibleRowIds = useMemo(() => displayedItems.map((item) => getRowId(item)), [displayedItems, getRowId]);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const selectionState = selection
    ? getVisibleSelectionState(visibleRowIds, selection.selectedRowIds)
    : { selectedVisibleRowsCount: 0, isAllVisibleRowsSelected: false, isSomeVisibleRowsSelected: false };

  useEffect(() => {
    syncIndeterminateCheckbox(selectAllCheckboxRef, selectionState.isSomeVisibleRowsSelected);
  }, [selectionState.isSomeVisibleRowsSelected]);

  // Column widths via drag

  const { columnWidths, handleResizeStart } = useUnifiedTableColumnResize(columns);

  // Visible columns

  const visibleColumnIds = visibleColumns ?? new Set(columns.map((column) => column.id));
  const displayedColumns = columns.filter((column) => visibleColumnIds.has(column.id));

  const getColumnStyle = (column: UnifiedTableColumn<TItem, TColumn>) => {
    const width = columnWidths[column.id];
    if (typeof width !== "number") return undefined;

    return {
      width: `${width}px`,
      minWidth: `${width}px`,
    };
  };

  const hasSelectionColumn = Boolean(selection);
  const stickyFirstHeadClassName = stickyFirstHeadClass(stickyFirstColumn, hasSelectionColumn);
  const stickyFirstCellClassName = stickyFirstBodyCellClass(stickyFirstColumn, hasSelectionColumn);

  const innerCard = (
    <UnifiedTableCard
      actions={actions}
      bodyClassName={bodyClassName}
      columns={columns}
      columnsMenu={columnsMenu}
      displayedColumns={displayedColumns}
      displayedItems={displayedItems}
      footer={footer}
      getColumnStyle={getColumnStyle}
      getRowId={getRowId}
      handleResizeStart={handleResizeStart}
      hasActionsColumn={hasActionsColumn}
      isServerPagination={isServerPagination}
      items={items}
      onRowClick={onRowClick}
      pagination={pagination}
      paginationEnabled={paginationEnabled}
      page={page}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      rowClassName={rowClassName}
      selectAllCheckboxRef={selectAllCheckboxRef}
      selection={selection}
      selectionState={selectionState}
      setClientPage={setClientPage}
      setClientPageSize={setClientPageSize}
      sorting={sorting}
      stickyFirstCellClassName={stickyFirstCellClassName}
      stickyFirstColumn={stickyFirstColumn}
      stickyFirstHeadClassName={stickyFirstHeadClassName}
      tableCardFlushTop={tableCardFlushTop}
      tableClassName={tableClassName}
      tableName={tableName}
      totalPages={totalPages}
      visibleColumnIds={visibleColumnIds}
      visibleRowIds={visibleRowIds}
    />
  );

  return (
    <div className={cn("min-h-0 min-w-0 flex flex-1 flex-col bg-[var(--table-canvas)] p-3", className)}>
      {showSectionHeader ? (
        <>
          <button
            type="button"
            aria-expanded={sectionExpanded}
            aria-controls={sectionPanelId}
            onClick={() => setSectionExpanded((value) => !value)}
            className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_50%)] px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--muted),transparent_20%)]"
          >
            <span className="min-w-0 text-sm font-semibold text-[var(--foreground)]">{tableName}</span>
            <ChevronRight
              aria-hidden
              className={cn("h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200", sectionExpanded && "rotate-90")}
            />
          </button>
          <div
            id={sectionPanelId}
            className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !sectionExpanded && "hidden")}
          >
            {innerCard}
          </div>
        </>
      ) : (
        innerCard
      )}
    </div>
  );
}
