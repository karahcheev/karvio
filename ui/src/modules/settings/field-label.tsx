import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";

/** Form-field label with an info icon that reveals a help tooltip on hover/focus. */
export function FieldLabel({ children, tip }: Readonly<{ children: ReactNode; tip: string }>) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            role="img"
            aria-label={tip}
            className="inline-flex cursor-help items-center text-[color-mix(in_srgb,var(--muted-foreground),transparent_20%)] hover:text-[var(--foreground)] focus-visible:text-[var(--foreground)] outline-none"
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
