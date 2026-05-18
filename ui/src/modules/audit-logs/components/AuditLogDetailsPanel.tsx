// Side panel: audit entry metadata, request, and optional diff.
import { SidePanel, SidePanelCard, SidePanelMetaRow, SidePanelSection } from "@/shared/ui/SidePanel";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import {
  collectChangedFields,
  formatUtcTimestamp,
  isIgnoredChangePath,
  shouldDisplayChangesForAction,
  stringifyJson,
} from "../utils";
import type { AuditTableRow } from "../types";

type Props = Readonly<{
  log: AuditTableRow;
  onClose: () => void;
}>;

export function AuditLogDetailsPanel({ log, onClose }: Props) {
  // Derived: field-level diff for display
  const changes = collectChangedFields(log.before, log.after).filter((change) => !isIgnoredChangePath(change.path));
  const shouldDisplayChanges = shouldDisplayChangesForAction(log.action);

  return (
    <SidePanel
      title={log.action}
      eyebrow={
        <>
          <StatusBadge tone={log.result === "success" ? "success" : "danger"} withBorder>
            {log.result}
          </StatusBadge>
          <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 font-mono text-xs text-[var(--muted-foreground)]">
            {log.event_id}
          </span>
        </>
      }
      subtitle={<span className="text-sm text-[var(--muted-foreground)]">{formatUtcTimestamp(log.timestamp_utc)}</span>}
      onClose={onClose}
      className="w-full sm:w-[640px]"
    >
      <div className="space-y-5">
        <SidePanelSection title="Request">
          <SidePanelCard>
            <SidePanelMetaRow label="Actor" value={log.actorLabel} />
            <SidePanelMetaRow label="Actor type" value={log.actor_type} />
            <SidePanelMetaRow
              label="Resource"
              value={log.resource_type ? `${log.resource_type}:${log.resource_id ?? "—"}` : "—"}
            />
            <SidePanelMetaRow label="Request ID" value={<span className="font-mono text-xs">{log.request_id ?? "—"}</span>} />
            <SidePanelMetaRow label="IP" value={log.ip ?? "—"} />
            <SidePanelMetaRow label="Tenant" value={log.tenant_id ?? "—"} />
            <SidePanelMetaRow label="User agent" value={log.user_agent ?? "—"} alignTop />
          </SidePanelCard>
        </SidePanelSection>

        {shouldDisplayChanges ? (
          <SidePanelSection title="Changes" description="Field-level diff when available.">
            {changes.length === 0 ? (
              <SidePanelCard className="border-dashed text-sm text-[var(--muted-foreground)]">No detected state changes.</SidePanelCard>
            ) : (
              <div className="space-y-3">
                {changes.map((change) => (
                  <SidePanelCard key={change.path} className="space-y-3 p-4">
                    <div className="font-mono text-[11px] text-[var(--muted-foreground)]">{change.path}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Before</div>
                        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 text-xs text-[var(--foreground)]">
                          {stringifyJson(change.before)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">After</div>
                        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 text-xs text-[var(--foreground)]">
                          {stringifyJson(change.after)}
                        </pre>
                      </div>
                    </div>
                  </SidePanelCard>
                ))}
              </div>
            )}
          </SidePanelSection>
        ) : null}

        <SidePanelSection title="Metadata">
          <SidePanelCard>
            <pre className="overflow-x-auto text-xs text-[var(--foreground)]">{stringifyJson(log.metadata)}</pre>
          </SidePanelCard>
        </SidePanelSection>
      </div>
    </SidePanel>
  );
}
