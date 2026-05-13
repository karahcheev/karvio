import { Info, Pencil, Trash2 } from "lucide-react";

import type { ComponentDto, ProductDto, ProductSummaryDto } from "@/shared/api";
import {
  Button,
  DetailsSection,
  EntityDetailsPanelLayout,
  MetaInfoCard,
  OverflowTagList,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui";

export function LabelWithTooltip({ label, description }: Readonly<{ label: string; description: string }>) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--foreground)]">
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

type RiskInsight = {
  title: string;
  message: string;
  tone: "high" | "neutral" | "positive";
};

function buildComponentRiskInsights(component: ComponentDto): {
  summary: string;
  insights: RiskInsight[];
} {
  const highThreshold = 4;
  const lowAutomationThreshold = 2;

  const potentialHighDrivers: Array<{ value: number; insight: RiskInsight }> = [
    {
      value: component.business_criticality,
      insight: {
        title: "Business impact",
        message: "This component is highly business-critical, so failures are likely to have broad user impact.",
        tone: "high",
      },
    },
    {
      value: component.change_frequency,
      insight: {
        title: "Frequent change",
        message: "This component changes often, which raises the chance of regressions between releases.",
        tone: "high",
      },
    },
    {
      value: component.integration_complexity,
      insight: {
        title: "Complex integrations",
        message: "This component has complex integrations, increasing dependency and coordination risk.",
        tone: "high",
      },
    },
    {
      value: component.defect_density,
      insight: {
        title: "Defect history",
        message: "This component has elevated defect density, suggesting a higher probability of future issues.",
        tone: "high",
      },
    },
    {
      value: component.production_incident_score,
      insight: {
        title: "Production incidents",
        message: "This component has a high production incident score, indicating recent real-world instability.",
        tone: "high",
      },
    },
  ];
  const highDrivers = potentialHighDrivers
    .filter((item) => item.value >= highThreshold)
    .map((item) => item.insight);

  const automationInsight: RiskInsight = component.automation_confidence <= lowAutomationThreshold
    ? {
      title: "Low automation confidence",
      message: "Low automation confidence amplifies risk because issues are less likely to be caught early.",
      tone: "high",
    }
    : component.automation_confidence >= highThreshold
      ? {
        title: "Automation support",
        message: "Stronger automation confidence helps contain risk by catching regressions earlier.",
        tone: "positive",
      }
      : {
        title: "Automation coverage",
        message: "Automation confidence is moderate, so manual validation still carries some risk.",
        tone: "neutral",
      };

  const insights = [...highDrivers, automationInsight];

  if (highDrivers.length === 0) {
    return {
      summary: "Risk appears to come from a mix of moderate factors rather than one dominant issue.",
      insights,
    };
  }

  return {
    summary: `Current risk is mainly driven by ${highDrivers.length === 1 ? "one high-impact factor" : `${highDrivers.length} high-impact factors`}.`,
    insights,
  };
}

export function ProductDetailsPanel({
  product,
  summary,
  linkedComponentIds,
  resolveComponentName,
  onOpenLinkedComponent,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
  onPreviewGeneratedPlan,
  busy,
}: Readonly<{
  product: ProductDto;
  summary: ProductSummaryDto | undefined;
  linkedComponentIds: string[];
  resolveComponentName: (componentId: string) => string;
  onOpenLinkedComponent: (componentId: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onPreviewGeneratedPlan: () => void;
  busy: {
    editing: boolean;
    toggling: boolean;
    deleting: boolean;
    previewingPlan: boolean;
  };
}>) {
  const coverageGapCards = [
    {
      label: "Uncovered components",
      value: summary?.uncovered_components ?? "—",
      toneClassName: "border-[color-mix(in_srgb,var(--destructive),transparent_60%)] bg-[color-mix(in_srgb,var(--destructive),transparent_95%)] text-[var(--destructive)]",
    },
    {
      label: "High-risk uncovered",
      value: summary?.high_risk_uncovered_components ?? "—",
      toneClassName: "border-[color-mix(in_srgb,var(--destructive),transparent_50%)] bg-[color-mix(in_srgb,var(--destructive),transparent_90%)] text-[var(--destructive)]",
    },
    {
      label: "Inadequately covered",
      value: summary?.inadequately_covered_components ?? "—",
      toneClassName: "border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--status-blocked)]",
    },
    {
      label: "Mandatory release cases",
      value: summary?.mandatory_release_cases ?? "—",
      toneClassName: "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] text-[var(--foreground)]",
    },
  ] as const;

  const sortedBreakdown = summary
    ? [...summary.per_component_breakdown].sort((a, b) => {
      const aPriority = (a.uncovered ? 3 : 0) + (!a.adequately_covered ? 2 : 0) + (a.risk_level === "critical" ? 2 : a.risk_level === "high" ? 1 : 0);
      const bPriority = (b.uncovered ? 3 : 0) + (!b.adequately_covered ? 2 : 0) + (b.risk_level === "critical" ? 2 : b.risk_level === "high" ? 1 : 0);
      if (aPriority !== bPriority) return bPriority - aPriority;

      const aGap = a.required_coverage_score - a.coverage_score;
      const bGap = b.required_coverage_score - b.coverage_score;
      if (aGap !== bGap) return bGap - aGap;

      return b.risk_score - a.risk_score;
    })
    : [];

  return (
    <EntityDetailsPanelLayout
      title={product.name}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            variant="primary"
            size="panel"
            onClick={onPreviewGeneratedPlan}
            disabled={busy.previewingPlan}
          >
            Preview plan
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onEdit}
            disabled={busy.editing}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onToggleStatus}
            disabled={busy.toggling}
          >
            {product.status === "active" ? "Archive" : "Activate"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="panel"
            onClick={onDelete}
            disabled={busy.deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </>
      }
    >
      <DetailsSection title="Overview">
        <MetaInfoCard
          rows={[
            { label: "Name", value: product.name },
            { label: "Key", value: product.key },
            { label: "Owner", value: product.owner_id ?? "—" },
            {
              label: "Tags",
              value: (
                <OverflowTagList
                  tags={product.tags ?? []}
                  mode="count"
                  maxVisible={3}
                  chipVariant="outline"
                  emptyContent="—"
                />
              ),
              alignTop: true,
            },
            { label: "Status", value: product.status },
            { label: "Description", value: product.description ?? "—" },
            { label: "Total components", value: summary?.total_components ?? "—" },
            { label: "Adequately covered", value: summary?.adequately_covered_components ?? "—" },
            { label: "Inadequately covered", value: summary?.inadequately_covered_components ?? "—" },
            { label: "Uncovered components", value: summary?.uncovered_components ?? "—" },
            { label: "High-risk uncovered", value: summary?.high_risk_uncovered_components ?? "—" },
            {
              label: "Coverage score",
              value: summary
                ? `${summary.coverage_score_total}/${summary.required_coverage_score_total}`
                : "—",
            },
            { label: "Mandatory release cases", value: summary?.mandatory_release_cases ?? "—" },
            { label: "Updated", value: new Date(product.updated_at).toLocaleString() },
          ]}
        />
      </DetailsSection>

      <DetailsSection title="Coverage gaps" description="Focus here first to close release risk quickly.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {coverageGapCards.map((card) => (
            <div key={card.label} className={`rounded-lg border px-3 py-2 ${card.toneClassName}`}>
              <div className="text-xs">{card.label}</div>
              <div className="text-lg font-semibold">{card.value}</div>
            </div>
          ))}
        </div>
      </DetailsSection>

      <DetailsSection title="Per-component breakdown" description="Coverage and risk by component.">
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="overflow-x-auto">
            <div className="min-w-[690px]">
              <div className="grid grid-cols-[minmax(180px,1.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(150px,1.2fr)] gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]">
                <div>Component</div>
                <div>Risk</div>
                <div>Coverage</div>
                <div>Status</div>
                <div>Case mix</div>
              </div>
              <div className="max-h-72 overflow-y-auto bg-white">
                {!summary ? (
                  <div className="px-3 py-3 text-sm text-[var(--muted-foreground)]">Coverage summary is loading...</div>
                ) : sortedBreakdown.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-[var(--muted-foreground)]">No component breakdown available yet.</div>
                ) : (
                  sortedBreakdown.map((item) => {
                    const statusLabel = item.uncovered
                      ? "Uncovered"
                      : item.adequately_covered
                        ? "Covered"
                        : "Needs coverage";
                    const statusClassName = item.uncovered
                      ? "border-[color-mix(in_srgb,var(--destructive),transparent_60%)] bg-[color-mix(in_srgb,var(--destructive),transparent_90%)] text-[var(--destructive)]"
                      : item.adequately_covered
                        ? "border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--status-passed)]"
                        : "border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--status-blocked)]";
                    return (
                      <div
                        key={item.component_id}
                        className="grid grid-cols-[minmax(180px,1.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(150px,1.2fr)] gap-2 border-b border-[color-mix(in_srgb,var(--border),transparent_30%)] px-3 py-2 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[var(--foreground)]">{item.component_name}</div>
                          <div className="truncate text-xs text-[var(--muted-foreground)]">{item.component_key}</div>
                        </div>
                        <div className="whitespace-nowrap text-[var(--foreground)]">
                          {item.risk_level.toUpperCase()} ({item.risk_score})
                        </div>
                        <div className="whitespace-nowrap text-[var(--foreground)]">
                          {item.coverage_score}/{item.required_coverage_score}
                        </div>
                        <div className="whitespace-nowrap">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="whitespace-nowrap text-[var(--muted-foreground)]">
                          S:{item.smoke_case_count} R:{item.regression_case_count} D:{item.deep_case_count}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </DetailsSection>

      <DetailsSection title="Included Components" description="Components currently in this release scope.">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="max-h-56 space-y-1 overflow-auto text-sm">
            {linkedComponentIds.length === 0 ? (
              <div className="text-[var(--muted-foreground)]">No components added yet. Use Edit to link components and define release scope.</div>
            ) : (
              linkedComponentIds.map((componentId) => (
                <button
                  key={componentId}
                  type="button"
                  className="w-full rounded-md px-2 py-1 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  onClick={() => onOpenLinkedComponent(componentId)}
                >
                  {resolveComponentName(componentId)}
                </button>
              ))
            )}
          </div>
        </div>
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}

export function ComponentDetailsPanel({
  component,
  dependencyComponentIds,
  resolveComponentName,
  onOpenDependencyComponent,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
  busy,
}: Readonly<{
  component: ComponentDto;
  dependencyComponentIds: string[];
  resolveComponentName: (componentId: string) => string;
  onOpenDependencyComponent: (componentId: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  busy: {
    editing: boolean;
    toggling: boolean;
    deleting: boolean;
  };
}>) {
  const riskInsights = buildComponentRiskInsights(component);

  const getInsightToneClassName = (tone: RiskInsight["tone"]) => {
    if (tone === "high") return "border-[color-mix(in_srgb,var(--destructive),transparent_60%)] bg-[color-mix(in_srgb,var(--destructive),transparent_90%)] text-[var(--destructive)]";
    if (tone === "positive") return "border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--status-passed)]";
    return "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] text-[var(--foreground)]";
  };

  return (
    <EntityDetailsPanelLayout
      title={component.name}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onEdit}
            disabled={busy.editing}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={onToggleStatus}
            disabled={busy.toggling}
          >
            {component.status === "active" ? "Archive" : "Activate"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="panel"
            onClick={onDelete}
            disabled={busy.deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </>
      }
    >
      <DetailsSection title="Why this risk" description={riskInsights.summary}>
        <div className="space-y-2">
          {riskInsights.insights.map((insight) => (
            <div
              key={insight.title}
              className={`rounded-lg border px-3 py-2 ${getInsightToneClassName(insight.tone)}`}
            >
              <div className="text-xs font-semibold">{insight.title}</div>
              <div className="text-sm">{insight.message}</div>
            </div>
          ))}
        </div>
      </DetailsSection>

      <DetailsSection title="Overview">
        <MetaInfoCard
          rows={[
            { label: "Name", value: component.name },
            { label: "Key", value: component.key },
            { label: "Owner", value: component.owner_id ?? "—" },
            {
              label: "Tags",
              value: (
                <OverflowTagList
                  tags={component.tags ?? []}
                  mode="count"
                  maxVisible={3}
                  chipVariant="outline"
                  emptyContent="—"
                />
              ),
              alignTop: true,
            },
            { label: "Status", value: component.status },
            { label: "Risk level", value: component.risk_level.toUpperCase() },
            { label: "Risk score", value: component.risk_score },
            { label: "Description", value: component.description ?? "—" },
            { label: "Updated", value: new Date(component.updated_at).toLocaleString() },
            { label: "Business criticality", value: component.business_criticality },
            { label: "Change frequency", value: component.change_frequency },
            { label: "Integration complexity", value: component.integration_complexity },
            { label: "Defect density", value: component.defect_density },
            { label: "Production incidents", value: component.production_incident_score },
            { label: "Automation confidence", value: component.automation_confidence },
          ]}
        />
      </DetailsSection>

      <DetailsSection title="Dependencies" description="Other components this item relies on.">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="max-h-56 space-y-1 overflow-auto text-sm">
            {dependencyComponentIds.length === 0 ? (
              <div className="text-[var(--muted-foreground)]">No dependencies mapped yet.</div>
            ) : (
              dependencyComponentIds.map((componentId) => (
                <button
                  key={componentId}
                  type="button"
                  className="w-full rounded-md px-2 py-1 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  onClick={() => onOpenDependencyComponent(componentId)}
                >
                  {resolveComponentName(componentId)}
                </button>
              ))
            )}
          </div>
        </div>
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}
