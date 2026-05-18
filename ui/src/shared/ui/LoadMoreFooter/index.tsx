// Footer bar for infinite lists: count summary and load-more control.

import { Button } from "@/shared/ui/Button";

type Props = Readonly<{
  loadedCount: number;
  noun: string;
  hasMore: boolean;
  isLoadingMore?: boolean;
  onLoadMore: () => void;
  hint?: string;
}>;

export function LoadMoreFooter({ loadedCount, noun, hasMore, isLoadingMore = false, onLoadMore, hint }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--card)] px-3 py-3">
      {/* Loaded count */}
      <div className="text-sm text-[var(--muted-foreground)]">
        Loaded {loadedCount} {noun}
        {hint ? <span className="ml-2 text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
      </div>
      {/* Pagination action */}
      {hasMore ? (
        <Button
          unstyled
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingMore ? "Loading more…" : "Load more"}
        </Button>
      ) : (
        <span className="text-xs text-[var(--muted-foreground)]">Everything currently available is loaded.</span>
      )}
    </div>
  );
}
