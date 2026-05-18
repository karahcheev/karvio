"use client";

// Row-level actions menu with optional links, separators, and destructive styling.

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/shared/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";
import { cn } from "@/shared/lib/cn";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";

type RowActionItem = Readonly<{
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void | Promise<void>;
  to?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separatorBefore?: boolean;
}>;

type RowActionsMenuProps = Readonly<{
  items: RowActionItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  triggerClassName?: string;
  triggerLabel?: string;
}>;

function RowActionsMenu({
  items,
  open,
  onOpenChange,
  align = "end",
  contentClassName,
  triggerClassName,
  triggerLabel = "Actions",
}: RowActionsMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Kebab trigger */}
      <DropdownMenuTrigger asChild>
        <Button
          unstyled
          type="button"
          className={cn("rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]", triggerClassName)}
          aria-label={triggerLabel}
          title={triggerLabel}
          data-actions-trigger
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* Action items */}
      <DropdownMenuContent
        align={align}
        className={cn("w-44", contentClassName)}
        data-actions-menu
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <React.Fragment key={item.key}>
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            {item.to ? (
              <DropdownMenuItem asChild variant={item.variant} disabled={item.disabled}>
                <Link
                  to={item.to}
                  onClick={() => {
                    invokeMaybeAsync(() => item.onSelect?.());
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant={item.variant}
                disabled={item.disabled}
                onClick={() => {
                  invokeMaybeAsync(() => item.onSelect?.());
                }}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RowActionsMenu };
export type { RowActionItem };
