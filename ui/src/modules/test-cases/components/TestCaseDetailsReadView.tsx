import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import type { TestCaseDetailsSharedProps } from "./TestCaseDetailsForm.types";
import { SidePanelMetaRow } from "@/shared/ui/SidePanel";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";
import { formatPriorityLabel } from "@/shared/domain/priority";
import { formatTestCaseTypeLabel } from "@/shared/domain/testCaseType";
import { TestCaseCoverageEditor } from "./TestCaseCoverageEditor";

export function TestCaseDetailsReadView({
  title,
  automationId,
  status,
  effectiveTestCaseType,
  priority,
  time,
  tags,
  ownerLabel,
  primaryProductId,
  componentCoverages,
  products,
  components,
  suiteLabel,
}: TestCaseDetailsSharedProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        <SidePanelMetaRow
          className="col-span-full border-b border-[var(--border)] pb-3 sm:col-span-2"
          label="Title"
          value={title || "Untitled test case"}
        />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Automation ID" value={automationId || "—"} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Status" value={formatTestCaseStatusLabel(status)} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Type" value={formatTestCaseTypeLabel(effectiveTestCaseType)} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Priority" value={formatPriorityLabel(priority)} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Expected Time" value={time || "—"} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Owner" value={ownerLabel} />
        <SidePanelMetaRow className="border-0 py-2 sm:py-2" label="Suite" value={suiteLabel} />
        <SidePanelMetaRow
          className="col-span-full border-0 py-2 sm:col-span-2 sm:py-2"
          label="Tags"
          value={
            tags.length > 0 ? (
              <TagList gap="sm">
                {tags.map((tag) => (
                  <TagChip key={tag} variant="outline">
                    {tag}
                  </TagChip>
                ))}
              </TagList>
            ) : (
              "—"
            )
          }
          alignTop
        />
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <TestCaseCoverageEditor
          isEditing={false}
          primaryProductId={primaryProductId}
          onPrimaryProductIdChange={() => undefined}
          componentCoverages={componentCoverages}
          onAddCoverage={() => undefined}
          onRemoveCoverage={() => undefined}
          onCoverageComponentChange={() => undefined}
          onCoverageStrengthChange={() => undefined}
          onCoverageMandatoryChange={() => undefined}
          productOptions={products}
          componentOptions={components}
        />
      </div>
    </div>
  );
}
