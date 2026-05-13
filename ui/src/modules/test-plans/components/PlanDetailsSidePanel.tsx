// Read-only test plan details with run, edit, and delete actions.
import type { TestPlanDto } from "@/shared/api";
import { Pencil, Play, Trash2 } from "lucide-react";
import {
  DetailsSection,
  EntityDetailsPanelLayout,
  MetaInfoCard,
} from "@/shared/ui/EntityDetailsPanelLayout";
import { Button } from "@/shared/ui/Button";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";

type Props = Readonly<{
  plan: TestPlanDto;
  onClose: () => void;
  onEdit: (plan: TestPlanDto) => void;
  onCreateRun: (plan: TestPlanDto) => void;
  onDelete: (plan: TestPlanDto) => void;
  resolveUserName: (userId: string | null | undefined) => string;
  createRunLoading: boolean;
}>;

export function PlanDetailsSidePanel({
  plan,
  onClose,
  onEdit,
  onCreateRun,
  onDelete,
  resolveUserName,
  createRunLoading,
}: Props) {
  return (
    <EntityDetailsPanelLayout
      title={plan.name}
      onClose={onClose}
      actions={
        <>
          <Button
            type="button"
            variant="primary"
            size="panel"
            onClick={() => onCreateRun(plan)}
            disabled={createRunLoading}
          >
            <Play className="h-3.5 w-3.5" />
            Create run
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="panel"
            onClick={() => onEdit(plan)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="danger"
            size="panel"
            onClick={() => onDelete(plan)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </>
      }
    >
      <DetailsSection title="Metadata">
        <MetaInfoCard
          rows={[
            { label: "ID", value: plan.id },
            { label: "Description", value: plan.description ?? "—" },
            {
              label: "Tags",
              value:
                plan.tags && plan.tags.length > 0 ? (
                  <TagList gap="sm">
                    {plan.tags.map((tag) => (
                      <TagChip key={tag} variant="outline">
                        {tag}
                      </TagChip>
                    ))}
                  </TagList>
                ) : (
                  "—"
                ),
              alignTop: true,
            },
            {
              label: "Suites",
              value:
                plan.suite_names && plan.suite_names.length > 0
                  ? plan.suite_names.join(", ")
                  : `${plan.suite_ids?.length ?? 0} suite(s)`,
            },
            {
              label: "Cases",
              value: (() => {
                if (plan.case_keys && plan.case_keys.length > 0) {
                  return plan.case_keys.join(", ");
                }
                if (plan.case_ids?.length) {
                  return `${plan.case_ids.length} case(s)`;
                }
                return "—";
              })(),
            },
            { label: "Created by", value: resolveUserName(plan.created_by) },
            {
              label: "Created",
              value: plan.created_at
                ? new Date(plan.created_at).toLocaleString()
                : "—",
            },
          ]}
        />
      </DetailsSection>
    </EntityDetailsPanelLayout>
  );
}
