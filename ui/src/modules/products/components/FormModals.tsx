import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { ComponentDto } from "@/shared/api";
import {
  Button,
  SelectField,
  TextareaField,
  TextField,
} from "@/shared/ui";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";

import { LabelWithTooltip } from "@/modules/products/components/DetailsPanels";

export type ProductFormState = {
  name: string;
  key: string;
  description: string;
};

export type ComponentRiskKey =
  | "business_criticality"
  | "change_frequency"
  | "integration_complexity"
  | "defect_density"
  | "production_incident_score"
  | "automation_confidence";

export type ComponentFormState = {
  name: string;
  key: string;
  description: string;
  business_criticality: number;
  change_frequency: number;
  integration_complexity: number;
  defect_density: number;
  production_incident_score: number;
  automation_confidence: number;
};

export type ComponentRiskLevel = "low" | "medium" | "high" | "critical";
export type ComponentRiskPreset = ComponentRiskLevel | "custom";

export type RiskFieldOption = {
  key: ComponentRiskKey;
  label: string;
  tooltip: string;
};

export function ProductFormModal({
  isOpen,
  isEditing,
  onClose,
  onSave,
  saveDisabled,
  relationsLoading,
  form,
  setForm,
  allComponents,
  allComponentsLoading,
  componentSelectionDraft,
  setComponentSelectionDraft,
}: Readonly<{
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  relationsLoading: boolean;
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  allComponents: Array<Pick<ComponentDto, "id" | "name">>;
  allComponentsLoading: boolean;
  componentSelectionDraft: Set<string>;
  setComponentSelectionDraft: Dispatch<SetStateAction<Set<string>>>;
}>) {
  const [linkedComponentsSearchQuery, setLinkedComponentsSearchQuery] = useState("");

  const filteredLinkedComponents = useMemo(() => {
    const query = linkedComponentsSearchQuery.trim().toLowerCase();
    if (!query) return allComponents;
    return allComponents.filter((component) => component.name.toLowerCase().includes(query));
  }, [allComponents, linkedComponentsSearchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setLinkedComponentsSearchQuery("");
    }
  }, [isOpen]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-xl flex-col overflow-hidden rounded-xl sm:w-full"
    >
      <StandardModalLayout
        title={isEditing ? "Edit Product" : "Create Product"}
        description={
          isEditing
            ? "Update the product scope so release coverage and plan inputs stay accurate."
            : "Create the product first, then link components from details when you are ready to map coverage."
        }
        onClose={onClose}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onSave}
              disabled={saveDisabled}
            >
              {isEditing ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {isEditing && relationsLoading ? (
            <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Loading current product scope...
            </div>
          ) : null}
          <TextField
            label="Product name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <TextField
            label="Key"
            value={form.key}
            onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
            hint="Optional short ID used in reports. Leave empty to auto-generate."
          />
          <TextareaField
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
          />
          {isEditing ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-sm font-medium text-[var(--foreground)]">Release scope components</div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Link components to define coverage scope and improve generated release plans.
                </p>
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {componentSelectionDraft.size > 0 ? `${componentSelectionDraft.size} selected` : "No components selected"}
              </div>
              <TextField
                label="Search components"
                value={linkedComponentsSearchQuery}
                onChange={(event) => setLinkedComponentsSearchQuery(event.target.value)}
                placeholder="Filter components..."
              />
              <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-[var(--border)] p-2">
                {allComponentsLoading ? (
                  <div className="text-sm text-[var(--muted-foreground)]">Loading components...</div>
                ) : allComponents.length === 0 ? (
                  <div className="text-sm text-[var(--muted-foreground)]">No components yet. Create components first, then return here to link them.</div>
                ) : filteredLinkedComponents.length === 0 ? (
                  <div className="text-sm text-[var(--muted-foreground)]">No matches for the current search.</div>
                ) : (
                  filteredLinkedComponents.map((component) => (
                    <label key={component.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={componentSelectionDraft.has(component.id)}
                        onChange={(event) => {
                          setComponentSelectionDraft((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(component.id);
                            else next.delete(component.id);
                            return next;
                          });
                        }}
                      />
                      <span>{component.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}

export function ComponentFormModal({
  isOpen,
  isEditing,
  onClose,
  onSave,
  saveDisabled,
  relationsLoading,
  form,
  setForm,
  componentRiskPreset,
  onRiskPresetChange,
  showAdvancedRiskControls,
  onToggleAdvancedRiskControls,
  riskFields,
  riskValues,
  editingComponentId,
  allComponents,
  allComponentsLoading,
  dependencySelectionDraft,
  setDependencySelectionDraft,
}: Readonly<{
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  relationsLoading: boolean;
  form: ComponentFormState;
  setForm: Dispatch<SetStateAction<ComponentFormState>>;
  componentRiskPreset: ComponentRiskPreset;
  onRiskPresetChange: (preset: ComponentRiskPreset) => void;
  showAdvancedRiskControls: boolean;
  onToggleAdvancedRiskControls: () => void;
  riskFields: RiskFieldOption[];
  riskValues: number[];
  editingComponentId: string | null;
  allComponents: Array<Pick<ComponentDto, "id" | "name">>;
  allComponentsLoading: boolean;
  dependencySelectionDraft: Set<string>;
  setDependencySelectionDraft: Dispatch<SetStateAction<Set<string>>>;
}>) {
  const [dependencySearchQuery, setDependencySearchQuery] = useState("");

  const availableDependencies = useMemo(
    () => allComponents.filter((component) => component.id !== editingComponentId),
    [allComponents, editingComponentId],
  );

  const filteredDependencies = useMemo(() => {
    const query = dependencySearchQuery.trim().toLowerCase();
    if (!query) return availableDependencies;
    return availableDependencies.filter((component) => component.name.toLowerCase().includes(query));
  }, [availableDependencies, dependencySearchQuery]);

  const selectedDependenciesCount = useMemo(
    () => availableDependencies.filter((component) => dependencySelectionDraft.has(component.id)).length,
    [availableDependencies, dependencySelectionDraft],
  );

  useEffect(() => {
    if (!isOpen) {
      setDependencySearchQuery("");
    }
  }, [isOpen]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-xl sm:w-full"
    >
      <StandardModalLayout
        title={isEditing ? "Edit Component" : "Create Component"}
        description={
          isEditing
            ? "Update risk and dependency details so release planning reflects current technical impact."
            : "Add component metadata, pick a risk preset, and save. Advanced factors are optional."
        }
        onClose={onClose}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onSave}
              disabled={saveDisabled}
            >
              {isEditing ? "Save changes" : "Create component"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {isEditing && relationsLoading ? (
            <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Loading current dependencies...
            </div>
          ) : null}
          <TextField
            label="Component name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <TextField
            label="Key"
            value={form.key}
            onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
            hint="Optional short ID used in reports. Leave empty to auto-generate."
          />
          <TextareaField
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
          />

          <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-[var(--foreground)]">Risk preset (recommended)</div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Choose a preset for the fastest setup. Use advanced factors only if you need fine-tuning.
              </p>
            </div>
            <SelectField
              label="Initial risk level"
              value={componentRiskPreset}
              onChange={(event) => onRiskPresetChange(event.target.value as ComponentRiskPreset)}
              hint="Presets are the default path for most components."
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="custom">Custom (advanced)</option>
            </SelectField>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onToggleAdvancedRiskControls}
            >
              {showAdvancedRiskControls ? "Hide advanced factors" : "Fine-tune with advanced factors"}
            </Button>
          </div>

          {showAdvancedRiskControls ? (
            <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                Optional: adjust individual factors when the preset does not match your component.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {riskFields.map((field) => (
                  <SelectField
                    key={field.key}
                    label={<LabelWithTooltip label={field.label} description={field.tooltip} />}
                    value={String(form[field.key])}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      onRiskPresetChange("custom");
                      setForm((current) => ({ ...current, [field.key]: value }));
                    }}
                  >
                    {riskValues.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </SelectField>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`space-y-2 rounded-lg border p-3 ${isEditing ? "border-[var(--border)] bg-[var(--background)]" : "border-[color-mix(in_srgb,var(--border),transparent_40%)] bg-[color-mix(in_srgb,var(--muted),transparent_70%)]"}`}>
            <div className="space-y-1">
              <div className="text-sm font-medium text-[var(--foreground)]">
                {isEditing ? "Component dependencies" : "Dependencies (optional)"}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {isEditing
                  ? "Update dependencies to keep technical risk and release impact accurate."
                  : "You can add dependencies now or come back later."}
              </p>
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {selectedDependenciesCount > 0 ? `${selectedDependenciesCount} selected` : "No components selected"}
            </div>
            <TextField
              label="Search dependencies"
              value={dependencySearchQuery}
              onChange={(event) => setDependencySearchQuery(event.target.value)}
              placeholder="Filter components..."
            />
            <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-[var(--border)] p-2">
              {allComponentsLoading ? (
                <div className="text-sm text-[var(--muted-foreground)]">Loading components...</div>
              ) : availableDependencies.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No other components yet. Add more components to map dependencies.
                </div>
              ) : filteredDependencies.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">No matches for the current search.</div>
              ) : (
                filteredDependencies.map((component) => (
                  <label key={component.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={dependencySelectionDraft.has(component.id)}
                      onChange={(event) => {
                        setDependencySelectionDraft((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(component.id);
                          else next.delete(component.id);
                          return next;
                        });
                      }}
                    />
                    <span>{component.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </StandardModalLayout>
    </AppModal>
  );
}
