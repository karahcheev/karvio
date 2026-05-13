// Draft filter fields for audit log list (apply/reset).
import type { UserDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextField } from "@/shared/ui";
import type { AuditFilters } from "../types";

type Props = Readonly<{
  draftFilters: AuditFilters;
  onDraftFiltersChange: (updater: (prev: AuditFilters) => AuditFilters) => void;
  actorOptions: UserDto[];
  onApply: () => void;
  onReset: () => void;
}>;

export function AuditLogsFilters({
  draftFilters,
  onDraftFiltersChange,
  actorOptions,
  onApply,
  onReset,
}: Props) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Result"
        value={draftFilters.result}
        onChange={(event) =>
          onDraftFiltersChange((current) => ({ ...current, result: event.target.value as AuditFilters["result"] }))
        }
      >
        <option value="all">All</option>
        <option value="success">success</option>
        <option value="fail">fail</option>
      </SelectField>

      <SelectField
        label="Actor"
        value={draftFilters.actorId}
        onChange={(event) => onDraftFiltersChange((current) => ({ ...current, actorId: event.target.value }))}
      >
        <option value="">All actors</option>
        {actorOptions.map((actor) => {
          const fullName = [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim();
          const label = fullName || actor.username;
          return (
            <option key={actor.id} value={actor.id}>
              {label} ({actor.username})
            </option>
          );
        })}
      </SelectField>

      <TextField
        label="Action (exact match)"
        type="text"
        value={draftFilters.action}
        onChange={(event) => onDraftFiltersChange((current) => ({ ...current, action: event.target.value }))}
        placeholder="e.g. user.create"
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Resource type"
          type="text"
          value={draftFilters.resourceType}
          onChange={(event) => onDraftFiltersChange((current) => ({ ...current, resourceType: event.target.value }))}
          placeholder="user, project..."
        />
        <TextField
          label="Resource ID"
          type="text"
          value={draftFilters.resourceId}
          onChange={(event) => onDraftFiltersChange((current) => ({ ...current, resourceId: event.target.value }))}
          placeholder="Entity ID"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button unstyled
          className="rounded-lg bg-[var(--action-primary-fill)] px-3 py-1.5 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
          onClick={onApply}
        >
          Apply
        </Button>
        <Button unstyled
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
