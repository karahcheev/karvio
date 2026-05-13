// Underline tab strip plus URL-hash friendly wrapper.

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";

export type UnderlineTabItem<T extends string> = Readonly<{
  value: T;
  label: string;
  icon?: ReactNode;
}>;

type UnderlineTabsProps<T extends string> = Readonly<{
  value: T;
  onChange: (next: T) => void;
  items: UnderlineTabItem<T>[];
  className?: string;
}>;

// Text-button tabs with underline indicator

export function UnderlineTabs<T extends string>({ value, onChange, items, className }: UnderlineTabsProps<T>) {
  return (
    <div className={cn("border-b border-[var(--border)] bg-[var(--card)] px-3", className)}>
      <div className="flex flex-wrap gap-6 pt-2">
        {items.map((item) => (
          <Button unstyled
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
              value === item.value
                ? "-mb-px rounded-t-lg border-b-2 border-[var(--action-primary-fill)] text-[var(--highlight-foreground)]"
                : "mb-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            {item.icon}
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

type UrlHashTabsProps<T extends string> = Readonly<{
  activeTab: T;
  items: UnderlineTabItem<T>[];
  onTabChange: (next: T) => void;
  className?: string;
}>;

// Same visuals; routing/hash integration stays in the parent hook

export function UrlHashTabs<T extends string>({
  activeTab,
  items,
  onTabChange,
  className,
}: UrlHashTabsProps<T>) {
  return (
    <UnderlineTabs
      value={activeTab}
      onChange={onTabChange}
      items={items}
      className={className}
    />
  );
}
