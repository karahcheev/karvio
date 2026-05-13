// Filter trigger with popover panel, header actions, and scrollable body.

import { useRef } from "react";
import { Filter } from "lucide-react";
import { useOnClickOutside } from "@/shared/lib/use-on-click-outside";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

type FiltersPopoverProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onClear: () => void;
  title?: string;
  triggerLabel?: string;
  clearLabel?: string;
  panelClassName?: string;
  children: React.ReactNode;
}>;

export function FiltersPopover({
  open,
  onOpenChange,
  activeCount,
  onClear,
  title = "Filters",
  triggerLabel = "Filters",
  clearLabel = "Clear all",
  panelClassName,
  children,
}: FiltersPopoverProps) {
  // Close when clicking outside while open

  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(
    ref,
    () => {
      onOpenChange(false);
    },
    open
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <Button unstyled
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          activeCount > 0
            ? "border-[var(--highlight-border)] bg-[var(--highlight-bg)] text-[var(--highlight-foreground)] hover:bg-[var(--highlight-bg-hover)]"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]"
        )}
      >
        <Filter className="h-4 w-4" />
        {triggerLabel}
        {activeCount > 0 ? (
          <span className="rounded-full bg-[var(--highlight-strong)] px-1.5 py-0.5 text-xs text-[var(--highlight-strong-foreground)]">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className={cn("absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg", panelClassName)}>
          {/* Panel header */}
          <div className="border-b border-[var(--border)] p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[var(--popover-foreground)]">{title}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-auto min-h-0 px-2 py-1 text-sm text-[var(--primary)] hover:bg-transparent hover:text-[color-mix(in_srgb,var(--primary),transparent_20%)]"
              >
                {clearLabel}
              </Button>
            </div>
          </div>

          {/* Filter controls */}
          <div className="space-y-4 p-3">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
