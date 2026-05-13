// Table primitives plus "standard" styled variants for entity lists.

import type React from "react";
import { Settings } from "lucide-react";
import { cn } from "@/shared/lib/cn";

const standardTableClassName = "min-w-full border-separate border-spacing-0 divide-y divide-border";
const standardTableHeadClassName = "bg-[var(--table-header-surface)]";
const standardTableHeadCellClassName =
  "border-b border-[var(--border)] bg-[var(--table-header-surface)] px-3 py-0 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]";
const standardTableCellClassName = "border-b border-[var(--border)] p-3 align-middle text-sm text-[var(--foreground)]";
const standardTableSelectionHeadCellClassName =
  "sticky left-0 z-30 w-[40px] min-w-[40px] max-w-[40px] bg-[var(--table-header-surface)] px-0";
const standardTableSelectionCellClassName =
  "sticky left-0 z-20 w-[40px] min-w-[40px] max-w-[40px] bg-[var(--card)] px-0";
const standardTableActionsHeadCellClassName =
  "sticky right-0 z-40 w-[52px] min-w-[52px] max-w-[52px] bg-[var(--table-header-surface)]";
const standardTableActionsCellClassName =
  "sticky right-0 z-10 w-[52px] min-w-[52px] max-w-[52px] bg-[var(--card)]";

function cellAlignClassName(
  align: React.ComponentProps<"th">["align"] | React.ComponentProps<"td">["align"] | undefined,
): string {
  if (align === "right") {
    return "text-right";
  }
  if (align === "center") {
    return "text-center";
  }
  return "text-left";
}

// Base table wrapper and white card shell

function Table({ className, ...props }: Readonly<React.ComponentProps<"table">>) {
  const { "aria-label": ariaLabel, children, ...rest } = props;
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        aria-label={ariaLabel ?? "Table"}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

function TableCard({ className, ...props }: Readonly<React.ComponentProps<"div">>) {
  return <div data-slot="table-card" className={cn("bg-[var(--table-surface)]", className)} {...props} />;
}

function StandardTable({ className, ...props }: Readonly<React.ComponentProps<"table">>) {
  return (
    <TableCard>
      <Table className={cn(standardTableClassName, className)} {...props} />
    </TableCard>
  );
}

// thead / tbody / tfoot, rows, and cells

function TableHeader({ className, ...props }: Readonly<React.ComponentProps<"thead">>) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: Readonly<React.ComponentProps<"tbody">>) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: Readonly<React.ComponentProps<"tfoot">>) {
  return (
    <tfoot data-slot="table-footer" className={cn("bg-[color-mix(in_srgb,var(--muted),transparent_50%)] border-t font-medium [&>tr]:last:border-b-0", className)} {...props} />
  );
}

function TableRow({ className, ...props }: Readonly<React.ComponentProps<"tr">>) {
  return (
    <tr
      data-slot="table-row"
      className={cn("hover:bg-[color-mix(in_srgb,var(--muted),transparent_50%)] data-[state=selected]:bg-[var(--muted)] border-b transition-colors", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: Readonly<React.ComponentProps<"th">>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-[var(--foreground)] h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: Readonly<React.ComponentProps<"td">>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: Readonly<React.ComponentProps<"caption">>) {
  return <caption data-slot="table-caption" className={cn("text-[var(--muted-foreground)] mt-4 text-sm", className)} {...props} />;
}

// Standard list table: sticky header, dense cells, selection and actions edges

function StandardTableHeader({ className, ...props }: Readonly<React.ComponentProps<"thead">>) {
  return <TableHeader className={cn("sticky top-0 z-30", standardTableHeadClassName, className)} {...props} />;
}

function StandardTableRow({ className, ...props }: Readonly<React.ComponentProps<"tr">>) {
  return <TableRow className={cn("cursor-pointer hover:bg-[color-mix(in_srgb,var(--muted),transparent_40%)]", className)} {...props} />;
}

function StandardTableHeadCell({
  className,
  align = "left",
  ...props
}: Readonly<React.ComponentProps<"th"> & { align?: React.ComponentProps<"th">["align"] }>) {
  return (
    <TableHead
      className={cn(standardTableHeadCellClassName, cellAlignClassName(align), className)}
      {...props}
    />
  );
}

function StandardTableCell({
  className,
  align = "left",
  nowrap = true,
  ...props
}: Readonly<
  React.ComponentProps<"td"> & {
    align?: React.ComponentProps<"td">["align"];
    nowrap?: boolean;
  }
>) {
  return (
    <TableCell
      className={cn(
        standardTableCellClassName,
        nowrap ? "overflow-hidden text-ellipsis whitespace-nowrap" : "overflow-hidden whitespace-normal",
        cellAlignClassName(align),
        className,
      )}
      {...props}
    />
  );
}

// Full-width placeholder row for empty/loading states

function StandardTableStateRow({
  colSpan,
  className,
  ...props
}: Readonly<React.ComponentProps<"td"> & { colSpan: number }>) {
  return (
    <tr>
      <StandardTableCell colSpan={colSpan} className={cn("text-[var(--muted-foreground)]", className)} {...props} />
    </tr>
  );
}

// Sticky selection checkbox column

function StandardTableSelectionHeadCell({
  children,
  className,
  ...props
}: Readonly<React.ComponentProps<"th">>) {
  return (
    <StandardTableHeadCell className={cn(standardTableSelectionHeadCellClassName, className)} {...props}>
      <div className="flex items-center justify-center">{children}</div>
    </StandardTableHeadCell>
  );
}

function StandardTableSelectionCell({ children, className, ...props }: Readonly<React.ComponentProps<"td">>) {
  return (
    <StandardTableCell className={cn(standardTableSelectionCellClassName, className)} {...props}>
      <div className="flex items-center justify-center">{children}</div>
    </StandardTableCell>
  );
}

// Sticky row actions column (settings icon by default)

function StandardTableActionsHeadCell({ children, className, ...props }: Readonly<React.ComponentProps<"th">>) {
  return (
    <StandardTableHeadCell align="center" className={cn(standardTableActionsHeadCellClassName, className)} {...props}>
      <div className="flex items-center justify-center">{children ?? <Settings className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />}</div>
    </StandardTableHeadCell>
  );
}

function StandardTableActionsCell({ className, ...props }: Readonly<React.ComponentProps<"td">>) {
  return <StandardTableCell align="center" className={cn(standardTableActionsCellClassName, className)} {...props} />;
}

export {
  Table,
  TableCard,
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableHeadCell,
  StandardTableCell,
  StandardTableStateRow,
  StandardTableSelectionHeadCell,
  StandardTableSelectionCell,
  StandardTableActionsHeadCell,
  StandardTableActionsCell,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  standardTableSelectionHeadCellClassName,
  standardTableSelectionCellClassName,
  standardTableActionsHeadCellClassName,
  standardTableActionsCellClassName,
};
