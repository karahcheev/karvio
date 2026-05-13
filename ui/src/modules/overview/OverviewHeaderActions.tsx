import { useRef } from "react";
import { Calendar, Download } from "lucide-react";
import { useOnClickOutside } from "@/shared/lib/use-on-click-outside";
import { Button } from "@/shared/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/DropdownMenu";
import { FilterChecklistSection } from "@/shared/ui/FilterChecklistSection";
import { OverviewCustomizeDashboard } from "./OverviewCustomizeDashboard";
import type { OverviewWidgetId } from "./overview-widget-config";
import type { OverviewWidgetDefinition } from "./overview-widget-registry";
import type { DatePreset } from "./use-overview-page-state";

type Props = Readonly<{
  overviewAvailable: boolean;
  dateFilterOpen: boolean;
  dateFilterLabel: string;
  draftDatePreset: DatePreset;
  draftDateFrom: string;
  draftDateTo: string;
  hasDateRangeError: boolean;
  setDateFilterOpen: (open: boolean) => void;
  openDateFilter: () => void;
  applyDateFilter: () => void;
  onDraftPresetSelect: (preset: DatePreset) => void;
  onDraftDateFromChange: (value: string) => void;
  onDraftDateToChange: (value: string) => void;
  milestoneOptions: Array<{ id: string; label: string }>;
  selectedMilestoneIds: Set<string>;
  onToggleMilestone: (milestoneId: string) => void;
  onExportJson: () => void;
  onExportXml: () => void;
  onExportPdf: () => void;
  widgetDefinitions: readonly OverviewWidgetDefinition[];
  enabledWidgetIds: OverviewWidgetId[];
  isWidgetRequired: (widgetId: OverviewWidgetId) => boolean;
  onToggleWidget: (widgetId: OverviewWidgetId) => void;
  onResetDashboard: () => void;
}>;

export function OverviewHeaderActions({
  overviewAvailable,
  dateFilterOpen,
  dateFilterLabel,
  draftDatePreset,
  draftDateFrom,
  draftDateTo,
  hasDateRangeError,
  setDateFilterOpen,
  openDateFilter,
  applyDateFilter,
  onDraftPresetSelect,
  onDraftDateFromChange,
  onDraftDateToChange,
  milestoneOptions,
  selectedMilestoneIds,
  onToggleMilestone,
  onExportJson,
  onExportXml,
  onExportPdf,
  widgetDefinitions,
  enabledWidgetIds,
  isWidgetRequired,
  onToggleWidget,
  onResetDashboard,
}: Props) {
  const dateFilterRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dateFilterRef, () => setDateFilterOpen(false), dateFilterOpen);

  return (
    <>
      <div ref={dateFilterRef} className="relative">
        <Button
          unstyled
          type="button"
          onClick={() => (dateFilterOpen ? setDateFilterOpen(false) : openDateFilter())}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
        >
          <Calendar className="h-4 w-4" />
          {dateFilterLabel}
        </Button>

        {dateFilterOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
            <div className="mb-2 text-sm font-medium text-[var(--foreground)]">Date range</div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button
                unstyled
                type="button"
                onClick={() => onDraftPresetSelect("7d")}
                className={`rounded-md border px-2 py-1.5 text-xs ${draftDatePreset === "7d" ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
              >
                Last 7 days
              </Button>
              <Button
                unstyled
                type="button"
                onClick={() => onDraftPresetSelect("30d")}
                className={`rounded-md border px-2 py-1.5 text-xs ${draftDatePreset === "30d" ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
              >
                Last 30 days
              </Button>
              <Button
                unstyled
                type="button"
                onClick={() => onDraftPresetSelect("90d")}
                className={`rounded-md border px-2 py-1.5 text-xs ${draftDatePreset === "90d" ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
              >
                Last 90 days
              </Button>
              <Button
                unstyled
                type="button"
                onClick={() => onDraftPresetSelect("180d")}
                className={`rounded-md border px-2 py-1.5 text-xs ${draftDatePreset === "180d" ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]" : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
              >
                Last 180 days
              </Button>
            </div>

            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="block text-xs font-medium text-[var(--foreground)]" htmlFor="overview-date-from">
                From
              </label>
              <input
                id="overview-date-from"
                type="date"
                value={draftDateFrom}
                onChange={(event) => onDraftDateFromChange(event.target.value)}
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
              />
              <label className="block text-xs font-medium text-[var(--foreground)]" htmlFor="overview-date-to">
                To
              </label>
              <input
                id="overview-date-to"
                type="date"
                value={draftDateTo}
                onChange={(event) => onDraftDateToChange(event.target.value)}
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm focus:border-[var(--highlight-border)] focus:outline-none focus:ring-1 focus:ring-[var(--control-focus-ring)]"
              />
              {hasDateRangeError ? <p className="text-xs text-[var(--status-failure)]">`From` must be earlier than `To`.</p> : null}
            </div>

            <FilterChecklistSection
              title="Milestone"
              values={milestoneOptions.map((option) => option.id)}
              selectedValues={selectedMilestoneIds}
              onToggle={onToggleMilestone}
              getLabel={(id) => milestoneOptions.find((option) => option.id === id)?.label ?? id}
              emptyLabel="No milestones found"
            />

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
              <Button
                unstyled
                type="button"
                onClick={() => setDateFilterOpen(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                Cancel
              </Button>
              <Button
                unstyled
                type="button"
                onClick={applyDateFilter}
                disabled={hasDateRangeError}
                className="rounded-md bg-[var(--action-primary-fill)] px-3 py-1.5 text-xs font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <OverviewCustomizeDashboard
        widgetDefinitions={widgetDefinitions}
        enabledWidgetIds={enabledWidgetIds}
        isWidgetRequired={isWidgetRequired}
        onToggleWidget={onToggleWidget}
        onReset={onResetDashboard}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            unstyled
            type="button"
            disabled={!overviewAvailable}
            className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={!overviewAvailable} onClick={onExportJson}>
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!overviewAvailable} onClick={onExportXml}>
            Export as XML
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!overviewAvailable} onClick={onExportPdf}>
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
