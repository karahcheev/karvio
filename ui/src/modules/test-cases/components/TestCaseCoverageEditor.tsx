import { Plus, Trash2 } from "lucide-react";
import type { EditableCoverage } from "@/modules/test-cases/utils/testCaseEditorTypes";
import { Button, SelectField } from "@/shared/ui";
import { FieldLabelWithHint } from "./TestCaseCommonFormFields";

const COVERAGE_STRENGTH_OPTIONS = [
  { value: "smoke", label: "Smoke" },
  { value: "regression", label: "Regression" },
  { value: "deep", label: "Deep" },
] as const;

export type ProductOption = { id: string; name: string };
export type ComponentOption = { id: string; name: string };

export function TestCaseCoverageEditor({
  isEditing,
  primaryProductId,
  onPrimaryProductIdChange,
  componentCoverages,
  onAddCoverage,
  onRemoveCoverage,
  onCoverageComponentChange,
  onCoverageStrengthChange,
  onCoverageMandatoryChange,
  productOptions,
  componentOptions,
}: Readonly<{
  isEditing: boolean;
  primaryProductId: string;
  onPrimaryProductIdChange: (value: string) => void;
  componentCoverages: EditableCoverage[];
  onAddCoverage: () => void;
  onRemoveCoverage: (coverageId: string) => void;
  onCoverageComponentChange: (coverageId: string, componentId: string) => void;
  onCoverageStrengthChange: (coverageId: string, strength: EditableCoverage["coverageStrength"]) => void;
  onCoverageMandatoryChange: (coverageId: string, isMandatory: boolean) => void;
  productOptions: ProductOption[];
  componentOptions: ComponentOption[];
}>) {
  const componentNameById = new Map(componentOptions.map((option) => [option.id, option.name]));

  return (
    <div className="space-y-3">
      <SelectField
        label={
          <FieldLabelWithHint
            label="Primary product"
            description="The main product this case validates. Used for filtering, ownership, and release coverage reports."
          />
        }
        value={primaryProductId}
        onChange={(event) => onPrimaryProductIdChange(event.target.value)}
        disabled={!isEditing}
      >
        <option value="none">None</option>
        {productOptions.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </SelectField>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-[var(--foreground)]">Component coverage</div>
          {isEditing ? (
            <Button type="button" variant="secondary" onClick={onAddCoverage}>
              <Plus className="h-3.5 w-3.5" />
              Add coverage
            </Button>
          ) : null}
        </div>

        {componentCoverages.length === 0 ? (
          <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            No covered components defined.
          </div>
        ) : (
          <div className="space-y-2">
            {componentCoverages.map((coverage) => (
              <div key={coverage.id} className="rounded-md border border-[var(--border)] p-2">
                {isEditing ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_auto_auto] md:items-end">
                    <SelectField
                      label={
                        <FieldLabelWithHint
                          label="Component"
                          description="Sub-component of the product that this case exercises. Pick the closest match — multiple coverages can be added."
                        />
                      }
                      value={coverage.componentId}
                      onChange={(event) => onCoverageComponentChange(coverage.id, event.target.value)}
                    >
                      <option value="">Select component</option>
                      {componentOptions.map((component) => (
                        <option key={component.id} value={component.id}>
                          {component.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label={
                        <FieldLabelWithHint
                          label="Strength"
                          description="How thorough this case is for the component: smoke = quick sanity, regression = standard pass, deep = exhaustive."
                        />
                      }
                      value={coverage.coverageStrength}
                      onChange={(event) => onCoverageStrengthChange(coverage.id, event.target.value as EditableCoverage["coverageStrength"])}
                    >
                      {COVERAGE_STRENGTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={coverage.isMandatoryForRelease}
                        onChange={(event) => onCoverageMandatoryChange(coverage.id, event.target.checked)}
                      />
                      Mandatory
                    </label>
                    <Button type="button" variant="danger" onClick={() => onRemoveCoverage(coverage.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_minmax(130px,1fr)]">
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Component</div>
                      <div className="text-[var(--foreground)]">{(componentNameById.get(coverage.componentId) ?? coverage.componentId) || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Strength</div>
                      <div className="text-[var(--foreground)]">{coverage.coverageStrength}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Mandatory</div>
                      <div className="text-[var(--foreground)]">{coverage.isMandatoryForRelease ? "Yes" : "No"}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
