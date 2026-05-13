import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui";

export function JiraFieldLabel({ label, description }: Readonly<{ label: string; description: string }>) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-help items-center text-[color-mix(in_srgb,var(--muted-foreground),transparent_20%)] hover:text-[var(--foreground)]"
            aria-label={description}
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-xs">
          {description}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
