// Inline loading indicator with optional label.

import { LoaderCircle } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type LoaderProps = Readonly<{
  label?: string;
  className?: string;
}>;

export function Loader({ label = "Loading…", className }: LoaderProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]", className)}>
      <LoaderCircle className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
