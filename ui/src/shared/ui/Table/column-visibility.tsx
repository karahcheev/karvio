// Dropdown to toggle which columns are visible in a data table.

import { Settings } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";
import { cn } from "@/shared/lib/cn";
import type { TableColumnOption } from "./types";

type TableColumnsMenuProps<TColumn extends string> = Readonly<{
  columns: TableColumnOption<TColumn>[];
  visibleColumns: Set<TColumn>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleColumn: (column: TColumn) => void;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}>;

export function TableColumnsMenu<TColumn extends string>({
  columns,
  visibleColumns,
  open,
  onOpenChange,
  onToggleColumn,
  triggerClassName,
  align = "end",
}: TableColumnsMenuProps<TColumn>) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Trigger */}
      <DropdownMenuTrigger asChild>
        <Button
          unstyled
          type="button"
          aria-label="Show columns"
          title="Show columns"
          className={cn("rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]", triggerClassName)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* Column checklist */}
      <DropdownMenuContent
        align={align}
        className="w-56"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visibleColumns.has(column.id)}
            disabled={column.locked}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => {
              if (!column.locked) {
                onToggleColumn(column.id);
              }
            }}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{column.label}</span>
              {column.locked ? <span className="ml-auto text-xs text-[var(--muted-foreground)]">Required</span> : null}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
