// Clickable summary cards to filter run items by outcome.
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CircleAlert, CircleDot, Clock, PlayCircle, SkipForward, XCircle } from "lucide-react";
import type { RunCaseDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";

type RunStatusCardsProps = Readonly<{
  total: number;
  passed: number;
  error: number;
  failure: number;
  blocked: number;
  inProgress: number;
  skipped: number;
  xfailed: number;
  xpassed: number;
  untested: number;
  selectedStatuses: Set<RunCaseDto["status"]>;
  onStatusCardClick: (status: RunCaseDto["status"] | "all") => void;
}>;

function RunStatusCard({
  selected,
  inactiveClasses,
  activeClasses,
  labelClassName,
  countClassName,
  label,
  count,
  Icon,
  onClick,
}: Readonly<{
  selected: boolean;
  inactiveClasses: string;
  activeClasses: string;
  labelClassName: string;
  countClassName: string;
  label: string;
  count: number;
  Icon?: LucideIcon;
  onClick: () => void;
}>) {
  return (
    <Button
      unstyled
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1.5 text-left transition ${
        selected ? activeClasses : inactiveClasses
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex min-w-0 items-center gap-1 text-xs font-medium ${labelClassName}`}>
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          <span className="truncate">{label}</span>
        </div>
        <span className={`shrink-0 text-base font-semibold tabular-nums ${countClassName}`}>{count}</span>
      </div>
    </Button>
  );
}

export function RunStatusCards({
  total,
  passed,
  error,
  failure,
  blocked,
  inProgress,
  skipped,
  xfailed,
  xpassed,
  untested,
  selectedStatuses,
  onStatusCardClick,
}: RunStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10">
      <RunStatusCard
        selected={selectedStatuses.size === 0}
        inactiveClasses="border-[var(--tone-neutral-border)] bg-[var(--card)] hover:bg-[var(--tone-neutral-bg-soft)]"
        activeClasses="border-[var(--tone-neutral-border-strong)] bg-[var(--tone-neutral-bg)] shadow-sm"
        labelClassName="text-[var(--muted-foreground)]"
        countClassName="text-[var(--foreground)]"
        label="Total Tests"
        count={total}
        onClick={() => onStatusCardClick("all")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("passed")}
        inactiveClasses="border-[var(--tone-success-border)] bg-[var(--tone-success-bg-soft)] hover:bg-[var(--tone-success-bg)]"
        activeClasses="border-[var(--tone-success-border-strong)] bg-[var(--tone-success-bg)] shadow-sm"
        labelClassName="text-[var(--tone-success-text)]"
        countClassName="text-[var(--tone-success-text)]"
        label="Passed"
        count={passed}
        Icon={CheckCircle2}
        onClick={() => onStatusCardClick("passed")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("error")}
        inactiveClasses="border-[var(--tone-error-border)] bg-[var(--tone-error-bg-soft)] hover:bg-[var(--tone-error-bg)]"
        activeClasses="border-[var(--tone-error-border-strong)] bg-[var(--tone-error-bg)] shadow-sm"
        labelClassName="text-[var(--tone-error-text)]"
        countClassName="text-[var(--tone-error-text)]"
        label="Error"
        count={error}
        Icon={XCircle}
        onClick={() => onStatusCardClick("error")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("failure")}
        inactiveClasses="border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] hover:bg-[var(--tone-danger-bg)]"
        activeClasses="border-[var(--tone-danger-border-strong)] bg-[var(--tone-danger-bg)] shadow-sm"
        labelClassName="text-[var(--tone-danger-text)]"
        countClassName="text-[var(--tone-danger-text)]"
        label="Failure"
        count={failure}
        Icon={XCircle}
        onClick={() => onStatusCardClick("failure")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("blocked")}
        inactiveClasses="border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] hover:bg-[var(--tone-warning-bg)]"
        activeClasses="border-[var(--tone-warning-border-strong)] bg-[var(--tone-warning-bg)] shadow-sm"
        labelClassName="text-[var(--tone-warning-text)]"
        countClassName="text-[var(--tone-warning-text)]"
        label="Blocked"
        count={blocked}
        Icon={Clock}
        onClick={() => onStatusCardClick("blocked")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("in_progress")}
        inactiveClasses="border-[var(--tone-info-border)] bg-[var(--tone-info-bg-soft)] hover:bg-[var(--tone-info-bg)]"
        activeClasses="border-[var(--tone-info-border-strong)] bg-[var(--tone-info-bg)] shadow-sm"
        labelClassName="text-[var(--tone-info-text)]"
        countClassName="text-[var(--tone-info-text)]"
        label="In Progress"
        count={inProgress}
        Icon={PlayCircle}
        onClick={() => onStatusCardClick("in_progress")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("skipped")}
        inactiveClasses="border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg-soft)] hover:bg-[var(--tone-neutral-bg)]"
        activeClasses="border-[var(--tone-neutral-border-strong)] bg-[var(--tone-neutral-bg)] shadow-sm"
        labelClassName="text-[var(--tone-neutral-text)]"
        countClassName="text-[var(--tone-neutral-text)]"
        label="Skipped"
        count={skipped}
        Icon={SkipForward}
        onClick={() => onStatusCardClick("skipped")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("xfailed")}
        inactiveClasses="border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg-soft)] hover:bg-[var(--tone-neutral-bg)]"
        activeClasses="border-[var(--tone-neutral-border-strong)] bg-[var(--tone-neutral-bg)] shadow-sm"
        labelClassName="text-[var(--tone-neutral-text)]"
        countClassName="text-[var(--tone-neutral-text)]"
        label="XFailed"
        count={xfailed}
        Icon={CircleDot}
        onClick={() => onStatusCardClick("xfailed")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("xpassed")}
        inactiveClasses="border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] hover:bg-[var(--tone-danger-bg)]"
        activeClasses="border-[var(--tone-danger-border-strong)] bg-[var(--tone-danger-bg)] shadow-sm"
        labelClassName="text-[var(--tone-danger-text)]"
        countClassName="text-[var(--tone-danger-text)]"
        label="XPassed"
        count={xpassed}
        Icon={CircleAlert}
        onClick={() => onStatusCardClick("xpassed")}
      />
      <RunStatusCard
        selected={selectedStatuses.size === 1 && selectedStatuses.has("untested")}
        inactiveClasses="border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg-soft)] hover:bg-[var(--tone-neutral-bg)]"
        activeClasses="border-[var(--tone-neutral-border-strong)] bg-[var(--tone-neutral-bg)] shadow-sm"
        labelClassName="text-[var(--tone-neutral-text)]"
        countClassName="text-[var(--tone-neutral-text)]"
        label="Untested"
        count={untested}
        onClick={() => onStatusCardClick("untested")}
      />
    </div>
  );
}
