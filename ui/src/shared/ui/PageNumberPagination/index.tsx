// Compact page-number control with ellipsis rules and prev/next.

import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

type PageToken = number | "ellipsis-left" | "ellipsis-right";

// Build 1…N token sequence with ellipses for large page counts

function buildPageTokens(page: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(2, page - 1);
  let end = Math.min(totalPages - 1, page + 1);

  if (page <= 3) {
    start = 2;
    end = Math.min(totalPages - 1, 5);
  } else if (page >= totalPages - 2) {
    start = Math.max(2, totalPages - 4);
    end = totalPages - 1;
  }

  const tokens: PageToken[] = [1];

  if (start > 2) {
    if (start === 3) {
      tokens.push(2);
    } else {
      tokens.push("ellipsis-left");
    }
  }

  for (let value = start; value <= end; value += 1) {
    tokens.push(value);
  }

  if (end < totalPages - 1) {
    if (end === totalPages - 2) {
      tokens.push(totalPages - 1);
    } else {
      tokens.push("ellipsis-right");
    }
  }

  tokens.push(totalPages);
  return tokens;
}

type Props = Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}>;

export function PageNumberPagination({ page, totalPages, onPageChange, className }: Props) {
  // Memoized button strip for current window

  const tokens = useMemo(() => buildPageTokens(page, totalPages), [page, totalPages]);

  if (totalPages <= 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Previous */}
      <Button unstyled
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {"<"}
      </Button>

      {/* Page numbers and ellipses */}
      {tokens.map((token, index) => {
        if (token === "ellipsis-left" || token === "ellipsis-right") {
          return (
            <span key={`${token}-${index}`} className="px-1 text-sm text-[var(--muted-foreground)]">
              ...
            </span>
          );
        }

        const isActive = token === page;
        return (
          <Button unstyled
            key={token}
            type="button"
            aria-label={`Go to page ${token}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onPageChange(token)}
            className={cn(
              "min-w-8 rounded-md border px-2 py-1 text-sm",
              isActive
                ? "border-[var(--action-primary-fill)] bg-[var(--action-primary-fill)] text-[var(--action-primary-foreground)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]"
            )}
          >
            {token}
          </Button>
        );
      })}

      {/* Next */}
      <Button unstyled
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {">"}
      </Button>
    </div>
  );
}
