import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";
import type { OverviewWidgetId } from "./overview-widget-config";
import type { OverviewWidgetDefinition } from "./overview-widget-registry";

type Props = Readonly<{
  widgetDefinitions: readonly OverviewWidgetDefinition[];
  enabledWidgetIds: OverviewWidgetId[];
  isWidgetRequired: (widgetId: OverviewWidgetId) => boolean;
  onToggleWidget: (widgetId: OverviewWidgetId) => void;
  onReset: () => void;
}>;

export function OverviewCustomizeDashboard({
  widgetDefinitions,
  enabledWidgetIds,
  isWidgetRequired,
  onToggleWidget,
  onReset,
}: Props) {
  const enabledSet = new Set(enabledWidgetIds);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          unstyled
          type="button"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Customize dashboard
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" sideOffset={8}>
        <DropdownMenuLabel>Visible widgets</DropdownMenuLabel>
        {widgetDefinitions.map((widget) => {
          const required = isWidgetRequired(widget.id) || widget.required;
          return (
            <DropdownMenuCheckboxItem
              key={widget.id}
              checked={enabledSet.has(widget.id)}
              disabled={required}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => {
                if (!required) {
                  onToggleWidget(widget.id);
                }
              }}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{widget.title}</span>
                {required ? <span className="ml-auto text-xs text-[var(--muted-foreground)]">Required</span> : null}
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onReset();
          }}
        >
          Reset to default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
