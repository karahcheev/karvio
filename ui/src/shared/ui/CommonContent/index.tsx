// Main scrollable content region for standard app pages.

import type { PropsWithChildren } from "react";
import { cn } from "@/shared/lib/cn";

export function CommonContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden p-3", className)}>{children}</div>;
}
