import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Checkbox } from "@/shared/ui/Checkbox";

export type TreeSelectionLeaf<T> = Readonly<{
  id: string;
  value: T;
  selected: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  onToggle: (value: T) => void;
  render: (value: T, selected: boolean) => React.ReactNode;
}>;

export type TreeSelectionNode<T> = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  expanded: boolean;
  selected: boolean;
  indeterminate?: boolean;
  children: TreeSelectionLeaf<T>[];
  onToggleExpand: () => void;
  onToggleSelected: () => void;
}>;

type TreeSelectionProps<T> = Readonly<{
  nodes: TreeSelectionNode<T>[];
  emptyState?: React.ReactNode;
  className?: string;
  nodeClassName?: string;
  childrenContainerClassName?: string;
  getLeafClassName?: (leaf: TreeSelectionLeaf<T>) => string;
}>;

export function TreeSelection<T>({
  nodes,
  emptyState,
  className,
  nodeClassName,
  childrenContainerClassName,
  getLeafClassName,
}: TreeSelectionProps<T>) {
  if (nodes.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        return (
          <div key={node.id} className={cn("rounded-lg border border-[var(--border)]", nodeClassName)}>
            <div className="flex items-center gap-2 p-2">
              <button
                type="button"
                onClick={node.onToggleExpand}
                disabled={!hasChildren}
                aria-label={node.expanded ? "Collapse" : "Expand"}
                className="rounded p-0.5 hover:bg-[var(--accent)] disabled:cursor-default disabled:hover:bg-transparent"
              >
                {(() => {
                  if (!hasChildren) {
                    return <span className="inline-block w-4" />;
                  }
                  if (node.expanded) {
                    return <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />;
                  }
                  return <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />;
                })()}
              </button>

              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <Checkbox
                  checked={node.selected}
                  ref={(element) => {
                    if (element) element.indeterminate = Boolean(node.indeterminate);
                  }}
                  onChange={node.onToggleSelected}
                />
                <div className="min-w-0">
                  <div className="font-medium text-[var(--foreground)]">{node.label}</div>
                  {node.description ? <div className="text-xs text-[var(--muted-foreground)]">{node.description}</div> : null}
                </div>
              </label>
            </div>

            {node.expanded && hasChildren ? (
              <div className={cn("border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_50%)] pl-8 pr-2 pb-2 pt-1", childrenContainerClassName)}>
                {node.children.map((leaf) => (
                  <label
                    key={leaf.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-[var(--accent)]",
                      (leaf.highlighted ?? leaf.selected) && "bg-[var(--highlight-bg-soft)]",
                      leaf.disabled && "cursor-not-allowed opacity-70",
                      getLeafClassName?.(leaf),
                    )}
                  >
                    <Checkbox
                      checked={leaf.selected}
                      onChange={() => leaf.onToggle(leaf.value)}
                      disabled={leaf.disabled}
                    />
                    <div className="min-w-0 flex-1">{leaf.render(leaf.value, leaf.selected)}</div>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
