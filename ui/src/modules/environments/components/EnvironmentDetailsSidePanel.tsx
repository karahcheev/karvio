import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { EnvironmentDto, EnvironmentRevisionDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";
import {
  DetailsSection,
  EntityDetailsPanelLayout,
  EntitySummaryCard,
  MetaInfoCard,
} from "@/shared/ui/EntityDetailsPanelLayout";

type Props = Readonly<{
  environment: EnvironmentDto | null;
  revisions: EnvironmentRevisionDto[];
  onClose: () => void;
  onEditStart: (environment: EnvironmentDto) => void;
  onDelete: (environment: EnvironmentDto) => void;
}>;

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatList(values: string[]): string {
  if (values.length === 0) return "-";
  return values.join(", ");
}

function renderTopologyOverview(environment: EnvironmentDto) {
  const sections: Array<{ title: string; items: Array<Record<string, unknown>> }> = [
    { title: "Load Generators", items: environment.topology.load_generators },
    { title: "System Under Test", items: environment.topology.system_under_test },
    { title: "Supporting Services", items: environment.topology.supporting_services },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <EntitySummaryCard key={section.title}>
          <div className="mb-2 text-sm font-medium text-[var(--foreground)]">{section.title}</div>
          {section.items.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">No components.</div>
          ) : (
            <div className="space-y-2">
              {section.items.map((component, index) => {
                const nodes = Array.isArray(component.nodes) ? component.nodes : [];
                const endpoints = Array.isArray(component.endpoints) ? component.endpoints : [];
                const tags = Array.isArray(component.tags) ? component.tags : [];
                return (
                  <div key={`${section.title}-${index}`} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {String(component.name ?? `Component ${index + 1}`)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Type: {String(component.component_type ?? "-")} · Nodes: {nodes.length} · Endpoints: {endpoints.length}
                    </div>
                    {endpoints.length > 0 ? (
                      <div className="mt-2 text-xs text-[var(--foreground)]">
                        Endpoints: {endpoints.map((endpoint) => String(endpoint)).join(", ")}
                      </div>
                    ) : null}
                    {tags.length > 0 ? (
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Tags: {tags.map((tag) => String(tag)).join(", ")}
                      </div>
                    ) : null}
                    {nodes.length > 0 ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {nodes.map((node, nodeIndex) => (
                          <div key={nodeIndex} className="rounded-md bg-[var(--muted)] p-2 text-xs text-[var(--foreground)]">
                            <div className="font-medium">{String(node.name ?? `Node ${nodeIndex + 1}`)}</div>
                            <div className="text-[var(--muted-foreground)]">
                              {String(node.host_type ?? "-")} · {String(node.provider ?? "-")} · {String(node.region ?? "-")}
                            </div>
                            {typeof node.endpoint === "string" && node.endpoint.trim() ? (
                              <div className="mt-1">Endpoint: {node.endpoint}</div>
                            ) : null}
                            {typeof node.count === "number" ? (
                              <div className="mt-1 text-[var(--muted-foreground)]">Count: {node.count}</div>
                            ) : null}
                            {Array.isArray(node.tags) && node.tags.length > 0 ? (
                              <div className="mt-1 text-[var(--muted-foreground)]">
                                Tags: {node.tags.map((tag: unknown) => String(tag)).join(", ")}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </EntitySummaryCard>
      ))}
    </div>
  );
}

export function EnvironmentDetailsSidePanel({
  environment,
  revisions,
  onClose,
  onEditStart,
  onDelete,
}: Props) {
  const title = environment?.name ?? "Environment";

  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const selectedRevision = useMemo(() => {
    if (revisions.length === 0) return null;
    if (selectedRevisionId) {
      const selected = revisions.find((revision) => revision.id === selectedRevisionId);
      if (selected) return selected;
    }
    return revisions.find((revision) => revision.is_current) ?? revisions[0];
  }, [revisions, selectedRevisionId]);

  let panelActions: ReactNode | undefined;
  if (environment) {
    panelActions = (
      <>
        <Button
          type="button"
          variant="secondary"
          size="panel"
          onClick={() => onEditStart(environment)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="danger"
          size="panel"
          onClick={() => onDelete(environment)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Archive
        </Button>
      </>
    );
  }

  return (
    <EntityDetailsPanelLayout
      title={title}
      onClose={onClose}
      actions={panelActions}
    >
      {(() => {
        if (environment) {
          return (
            <>
              <DetailsSection title="Overview">
                <MetaInfoCard
                  rows={[
                    { label: "Name", value: environment.name },
                    { label: "Status", value: environment.status ?? "active" },
                    { label: "Kind", value: environment.kind ?? "custom" },
                    { label: "Description", value: environment.description ?? "-" },
                    { label: "Use Cases", value: formatList(environment.use_cases) },
                    { label: "Tags", value: formatList(environment.tags) },
                    {
                      label: "Current Revision",
                      value: environment.current_revision_number != null ? `r${environment.current_revision_number}` : "-",
                    },
                    {
                      label: "Topology Summary",
                      value: `${environment.topology_component_count ?? 0} components · ${environment.topology_node_count ?? 0} nodes · ${environment.topology_endpoint_count ?? 0} endpoints`,
                    },
                    {
                      label: "Infra Summary",
                      value: `${formatList(environment.infra_host_types ?? [])} | ${formatList(environment.infra_providers ?? [])}`,
                    },
                    {
                      label: "Regions",
                      value: formatList(environment.infra_regions ?? []),
                    },
                    {
                      label: "Graph",
                      value: `${environment.entities_count ?? 0} entities · ${environment.edges_count ?? 0} edges`,
                    },
                    {
                      label: "Updated",
                      value: new Date(environment.updated_at).toLocaleString(),
                    },
                  ]}
                />
              </DetailsSection>

              <DetailsSection title="Topology">
                {renderTopologyOverview(environment)}
              </DetailsSection>

              <DetailsSection title="Revisions">
                <EntitySummaryCard>
                  {revisions.length === 0 ? (
                    <div className="text-sm text-[var(--muted-foreground)]">No revisions found.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {revisions.map((revision) => (
                          <button
                            key={revision.id}
                            type="button"
                            className={`w-full rounded-lg border p-3 text-left transition ${
                              selectedRevision?.id === revision.id
                                ? "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)]"
                                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
                            }`}
                            onClick={() => setSelectedRevisionId(revision.id)}
                          >
                            <div className="text-sm font-medium text-[var(--foreground)]">
                              Revision r{revision.revision_number}
                              {revision.is_current ? " (current)" : ""}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {new Date(revision.created_at).toLocaleString()} · {revision.entities.length} entities · {revision.edges.length} edges
                            </div>
                            {revision.revision_note ? (
                              <div className="mt-1 text-sm text-[var(--foreground)]">{revision.revision_note}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                      {selectedRevision ? (
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-sm font-medium text-[var(--foreground)]">
                            Selected r{selectedRevision.revision_number}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                            Snapshot hash: {selectedRevision.snapshot_hash}
                          </div>
                          <div className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                            Topology Snapshot
                          </div>
                          <pre className="overflow-x-auto text-xs text-[var(--foreground)]">
                            {toPrettyJson(selectedRevision.full_snapshot?.topology ?? {})}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}
                </EntitySummaryCard>
              </DetailsSection>

              <DetailsSection title="Advanced">
                <EntitySummaryCard>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Topology JSON</div>
                      <pre className="overflow-x-auto text-xs text-[var(--foreground)]">{toPrettyJson(environment.topology)}</pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Meta JSON</div>
                      <pre className="overflow-x-auto text-xs text-[var(--foreground)]">{toPrettyJson(environment.meta)}</pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Extra JSON</div>
                      <pre className="overflow-x-auto text-xs text-[var(--foreground)]">{toPrettyJson(environment.extra ?? {})}</pre>
                    </div>
                  </div>
                </EntitySummaryCard>
              </DetailsSection>
            </>
          );
        }
        return null;
      })()}
    </EntityDetailsPanelLayout>
  );
}
