// Full-height page shell with neutral background and overflow containment.

import type { PropsWithChildren } from "react";
import { cn } from "@/shared/lib/cn";

export function CommonPage({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex h-full flex-col overflow-hidden bg-[var(--table-canvas)]", className)}>{children}</div>;
}
