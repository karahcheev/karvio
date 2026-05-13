import type React from "react";

export type TableColumnOption<TColumn extends string> = {
  id: TColumn;
  label: string;
  locked?: boolean;
};

export type UnifiedTableColumn<TItem, TColumn extends string> = {
  id: TColumn;
  label: React.ReactNode;
  menuLabel: string;
  sortable?: boolean;
  defaultSortDirection?: "asc" | "desc";
  defaultWidth?: number;
  minWidth?: number;
  locked?: boolean;
  nowrap?: boolean;
  headClassName?: string;
  cellClassName?: string;
  cellStyle?: React.CSSProperties | ((item: TItem) => React.CSSProperties | undefined);
  onCellClick?: (event: React.MouseEvent<HTMLTableCellElement>, item: TItem) => void;
  renderCell: (item: TItem) => React.ReactNode;
};

export type UnifiedTableSorting<TColumn extends string> = {
  column: TColumn;
  direction: "asc" | "desc";
};

export type UnifiedTableProps<TItem, TColumn extends string> = {
  items: TItem[];
  columns: UnifiedTableColumn<TItem, TColumn>[];
  visibleColumns?: Set<TColumn>;
  /**
   * Accessible name for this `<table>` (e.g. transaction group label).
   * Renders a visually hidden caption so multiple tables on one page stay distinguishable for assistive tech.
   */
  tableName?: string;
  /**
   * When true, the white table card uses square top corners (`rounded-b-lg` only), no own border — use when an outer wrapper (e.g. group section) already draws the frame.
   */
  tableCardFlushTop?: boolean;
  /**
   * When true with `tableName`, renders a titled bar above the table card with a chevron to collapse/expand the table (and pagination/footer inside the card).
   */
  sectionCollapsible?: boolean;
  /** Initial expanded state when `sectionCollapsible` is true. Default: expanded. */
  sectionDefaultExpanded?: boolean;
  /**
   * When true, the first visible data column stays fixed on horizontal scroll.
   * If `selection` is set, the checkbox column is already pinned; the first data column pins to its right (40px).
   */
  stickyFirstColumn?: boolean;
  className?: string;
  tableClassName?: string;
  bodyClassName?: string;
  rowClassName?: string | ((item: TItem) => string | undefined);
  getRowId: (item: TItem) => string;
  onRowClick?: (item: TItem) => void;
  selection?: {
    selectedRowIds: Set<string>;
    onToggleSelectAll: (checked: boolean, visibleRowIds?: string[], visibleItems?: TItem[]) => void;
    onToggleRow: (rowId: string) => void;
    ariaLabel?: (item: TItem) => string;
    /** When true, row checkbox is disabled (e.g. selection cap reached). */
    isRowSelectionDisabled?: (item: TItem) => boolean;
  };
  columnsMenu?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onToggleColumn: (column: TColumn) => void;
    triggerClassName?: string;
    align?: "start" | "center" | "end";
  };
  actions?: {
    render: (item: TItem) => React.ReactNode;
    headContent?: React.ReactNode;
  };
  footer?: React.ReactNode;
  pagination?: {
    enabled?: boolean;
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    /**
     * Server-driven pages: `items` is already the current page from the API.
     * Provide page, totalPages, pageSize, and change handlers.
     */
    mode?: "client" | "server";
    page?: number;
    totalPages?: number;
    /** Total rows for current filters; omit if the API does not return a total */
    totalItems?: number;
    pageSize?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  sorting?: {
    value: UnifiedTableSorting<TColumn>;
    onChange: (next: UnifiedTableSorting<TColumn>) => void;
  };
};
