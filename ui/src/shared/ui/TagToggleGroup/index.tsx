import * as React from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

type TagToggleGroupProps = Readonly<{
  tags: string[];
  selectedTags: Set<string>;
  onToggle: (tag: string) => void;
  emptyState?: React.ReactNode;
  className?: string;
  getTagLabel?: (tag: string) => React.ReactNode;
}>;

export function TagToggleGroup({
  tags,
  selectedTags,
  onToggle,
  emptyState,
  className,
  getTagLabel,
}: TagToggleGroupProps) {
  if (tags.length === 0) {
    return (
      <>
        {emptyState ?? (
          <div className="rounded-lg border border-dashed border-[var(--tag-empty-border)] bg-[var(--tag-empty-bg)] p-3 text-sm text-[var(--tag-empty-foreground)]">No tags found</div>
        )}
      </>
    );
  }

  return (
    <fieldset aria-label="Tags" className={cn("m-0 flex flex-wrap gap-2 border-0 p-0", className)}>
      {tags.map((tag) => {
        const selected = selectedTags.has(tag);
        return (
          <Button
            type="button"
            unstyled
            key={tag}
            onClick={() => onToggle(tag)}
            aria-pressed={selected}
            className={cn(
              "rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
              selected
                ? "border-[var(--highlight-border)] bg-[var(--highlight-bg)] text-[var(--highlight-foreground)]"
                : "border-[var(--tag-toggle-border)] bg-[var(--tag-toggle-bg)] text-[var(--tag-toggle-foreground)] hover:border-[var(--tag-toggle-hover-border)]",
            )}
          >
            {getTagLabel ? getTagLabel(tag) : tag}
            {selected ? (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--highlight-strong)] text-xs text-[var(--highlight-strong-foreground)]">✓</span>
            ) : null}
          </Button>
        );
      })}
    </fieldset>
  );
}
