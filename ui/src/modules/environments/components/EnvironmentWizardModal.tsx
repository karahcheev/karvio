import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Circle, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { AppModal, Button, SelectField, TextField, TextareaField, WizardModalLayout } from "@/shared/ui";
import {
  cloneEnvironmentHostDraft,
  createEmptyEnvironmentHostDraft,
  ENVIRONMENT_HOST_PLACEMENT_OPTIONS,
  ENVIRONMENT_HOST_TYPE_OPTIONS,
  placementLabel,
  type EnvironmentDraft,
  type EnvironmentHostDraft,
} from "./EnvironmentEditorForm";

type Props = Readonly<{
  isOpen: boolean;
  isCreating: boolean;
  isSaving: boolean;
  draft: EnvironmentDraft;
  onDraftChange: (
    value: EnvironmentDraft | ((prev: EnvironmentDraft) => EnvironmentDraft),
  ) => void;
  onClose: () => void;
  onCancel: () => void;
  onSave: () => void;
}>;

type WizardStep = "info" | "hosts" | "review";
type WizardStepStatus = "current" | "complete" | "error" | "upcoming";

type HostEditorState = {
  mode: "create" | "edit";
  index: number | null;
  value: EnvironmentHostDraft;
};

function StepIcon({ status }: Readonly<{ status: WizardStepStatus }>) {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 text-[var(--status-passed)]" />;
  }
  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-[var(--status-failure)]" />;
  }
  if (status === "current") {
    return <Circle className="h-4 w-4 fill-[var(--highlight-bg)] text-[var(--highlight-border)]" />;
  }
  return <Circle className="h-4 w-4 text-[var(--muted-foreground)]" />;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function validateInfo(draft: EnvironmentDraft): { name?: string } {
  return {
    name: draft.name.trim() ? undefined : "Environment name is required.",
  };
}

function validateHosts(draft: EnvironmentDraft): {
  missingHosts: boolean;
  duplicateNames: Set<string>;
  invalidHostIds: Set<string>;
} {
  const duplicateNames = new Set<string>();
  const invalidHostIds = new Set<string>();
  const byName = new Map<string, number>();

  for (const host of draft.hosts) {
    const normalizedName = host.name.trim().toLowerCase();
    if (normalizedName) {
      byName.set(normalizedName, (byName.get(normalizedName) ?? 0) + 1);
    }

    if (!host.name.trim() || !host.hostType.trim() || parsePositiveInt(host.count) == null) {
      invalidHostIds.add(host.id);
    }
  }

  for (const [name, count] of byName) {
    if (count > 1) duplicateNames.add(name);
  }

  return {
    missingHosts: draft.hosts.length === 0,
    duplicateNames,
    invalidHostIds,
  };
}

function collectReviewIssues(draft: EnvironmentDraft): string[] {
  const issues: string[] = [];

  const pushJsonIssue = (value: string, label: string) => {
    const normalized = value.trim() || "{}";
    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        issues.push(`${label} must be a JSON object.`);
      }
    } catch {
      issues.push(`${label} must contain valid JSON.`);
    }
  };

  pushJsonIssue(draft.metaJson, "Meta");
  pushJsonIssue(draft.extraJson, "Extra");

  draft.hosts.forEach((host, index) => {
    pushJsonIssue(host.resourcesJson, `Host ${index + 1} resources`);
    pushJsonIssue(host.metadataJson, `Host ${index + 1} metadata`);
    pushJsonIssue(host.componentMetadataJson, `Host ${index + 1} component metadata`);
  });

  return issues;
}

function buildHostSummary(host: EnvironmentHostDraft): string {
  const secondary: string[] = [placementLabel(host.placement), host.hostType];
  if (host.provider.trim()) secondary.push(host.provider.trim());
  if (host.region.trim()) secondary.push(host.region.trim());
  const count = parsePositiveInt(host.count) ?? 1;
  secondary.push(`x${count}`);
  return secondary.join(" · ");
}

export function EnvironmentWizardModal({
  isOpen,
  isCreating,
  isSaving,
  draft,
  onDraftChange,
  onClose,
  onCancel,
  onSave,
}: Props) {
  const [activeStep, setActiveStep] = useState<WizardStep>("info");
  const [infoTouched, setInfoTouched] = useState(false);
  const [hostsTouched, setHostsTouched] = useState(false);
  const [reviewTouched, setReviewTouched] = useState(false);
  const [hostEditor, setHostEditor] = useState<HostEditorState | null>(null);
  const [hostEditorError, setHostEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveStep("info");
    setInfoTouched(false);
    setHostsTouched(false);
    setReviewTouched(false);
    setHostEditor(null);
    setHostEditorError(null);
  }, [isOpen, isCreating]);

  const infoErrors = useMemo(() => validateInfo(draft), [draft]);
  const hostsValidation = useMemo(() => validateHosts(draft), [draft]);
  const reviewIssues = useMemo(() => collectReviewIssues(draft), [draft]);

  const infoValid = !infoErrors.name;
  const hostsValid =
    !hostsValidation.missingHosts &&
    hostsValidation.duplicateNames.size === 0 &&
    hostsValidation.invalidHostIds.size === 0;
  const reviewValid = reviewIssues.length === 0;

  const handleStepClick = (step: WizardStep) => {
    if (step === "info") {
      setActiveStep("info");
      return;
    }

    setInfoTouched(true);
    if (!infoValid) {
      setActiveStep("info");
      return;
    }

    if (step === "hosts") {
      setActiveStep("hosts");
      return;
    }

    setHostsTouched(true);
    if (!hostsValid) {
      setActiveStep("hosts");
      return;
    }

    setActiveStep("review");
  };

  const handleNext = () => {
    if (activeStep === "info") {
      setInfoTouched(true);
      if (!infoValid) return;
      setActiveStep("hosts");
      return;
    }

    if (activeStep === "hosts") {
      setHostsTouched(true);
      if (!hostsValid) return;
      setActiveStep("review");
    }
  };

  const handleSave = () => {
    setInfoTouched(true);
    setHostsTouched(true);
    setReviewTouched(true);

    if (!infoValid) {
      setActiveStep("info");
      return;
    }
    if (!hostsValid) {
      setActiveStep("hosts");
      return;
    }
    if (!reviewValid) {
      setActiveStep("review");
      return;
    }

    onSave();
  };

  const saveHostEditor = () => {
    if (!hostEditor) return;

    const host = hostEditor.value;
    if (!host.name.trim()) {
      setHostEditorError("Host name is required.");
      return;
    }
    if (!host.hostType.trim()) {
      setHostEditorError("Host type is required.");
      return;
    }
    if (parsePositiveInt(host.count) == null) {
      setHostEditorError("Host count must be a positive number.");
      return;
    }

    setHostEditorError(null);

    onDraftChange((current) => {
      if (hostEditor.mode === "edit" && hostEditor.index != null) {
        return {
          ...current,
          hosts: current.hosts.map((currentHost, index) => (index === hostEditor.index ? host : currentHost)),
        };
      }

      return {
        ...current,
        hosts: [...current.hosts, host],
      };
    });

    setHostEditor(null);
  };

  let infoStepStatus: WizardStepStatus = "complete";
  if (activeStep === "info") {
    infoStepStatus = "current";
  } else if (infoTouched && !infoValid) {
    infoStepStatus = "error";
  }

  let hostsStepStatus: WizardStepStatus = "upcoming";
  if (activeStep === "hosts") {
    hostsStepStatus = hostsTouched && !hostsValid ? "error" : "current";
  } else if (activeStep === "review") {
    hostsStepStatus = hostsValid ? "complete" : "error";
  }

  let reviewStepStatus: WizardStepStatus = "upcoming";
  if (activeStep === "review") {
    reviewStepStatus = reviewTouched && !reviewValid ? "error" : "current";
  }

  const stepItems: Array<{
    id: WizardStep;
    title: string;
    description: string;
    status: WizardStepStatus;
  }> = [
    {
      id: "info",
      title: "Environment Info",
      description: "Name and registry metadata",
      status: infoStepStatus,
    },
    {
      id: "hosts",
      title: "Hosts",
      description: "Add hosts one by one",
      status: hostsStepStatus,
    },
    {
      id: "review",
      title: "Review",
      description: "Validate and create",
      status: reviewStepStatus,
    },
  ];

  const hostsByPlacement = useMemo(() => {
    return {
      system_under_test: draft.hosts.filter((host) => host.placement === "system_under_test"),
      supporting_services: draft.hosts.filter((host) => host.placement === "supporting_services"),
      load_generators: draft.hosts.filter((host) => host.placement === "load_generators"),
    };
  }, [draft.hosts]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSaving}
      closeOnEscape={!isSaving}
      contentClassName="h-[92vh] max-w-6xl rounded-xl sm:max-w-6xl"
    >
      <WizardModalLayout
        title={isCreating ? "New Environment" : "Edit Environment"}
        description="Build environment info first, then add hosts one by one and review before saving."
        sidebar={(
          <nav aria-label="Environment wizard steps">
            <ol className="space-y-2">
              {stepItems.map((step, index) => (
                <li
                  key={step.id}
                  className={(() => {
                    if (step.status === "current") {
                      return "rounded-xl border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] px-3 py-2";
                    }
                    if (step.status === "error") {
                      return "rounded-xl border border-[var(--tone-danger-border-strong)] bg-[var(--tone-danger-bg-soft)] px-3 py-2";
                    }
                    return "rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2";
                  })()}
                >
                  <button
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--control-focus-ring),transparent_60%)]"
                    aria-current={step.status === "current" ? "step" : undefined}
                  >
                    <div className="flex items-start gap-2">
                      <StepIcon status={step.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{step.description}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        footer={(
          <>
            <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            {activeStep !== "info" ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setActiveStep(activeStep === "review" ? "hosts" : "info")}
                disabled={isSaving}
              >
                Back
              </Button>
            ) : null}
            {activeStep !== "review" ? (
              <Button type="button" variant="primary" size="md" onClick={handleNext} disabled={isSaving}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSave}
                disabled={isSaving || !infoValid || !hostsValid || !reviewValid}
              >
                {isCreating ? "Create Environment" : "Save"}
              </Button>
            )}
          </>
        )}
        onClose={onClose}
        closeButtonDisabled={isSaving}
        sidebarClassName="w-[28%] p-3"
        mainClassName="w-[72%]"
      >
        {activeStep === "info" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Name"
                value={draft.name}
                onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
                disabled={isSaving}
                placeholder="staging-eu"
              />
              <SelectField
                label="Status"
                value={draft.status}
                onChange={(event) => onDraftChange((current) => ({ ...current, status: event.target.value }))}
                disabled={isSaving}
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="deprecated">Deprecated</option>
              </SelectField>
            </div>
            {infoTouched && infoErrors.name ? (
              <div className="rounded-md border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] px-3 py-2 text-sm text-[var(--status-failure)]">{infoErrors.name}</div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Kind"
                value={draft.kind}
                onChange={(event) => onDraftChange((current) => ({ ...current, kind: event.target.value }))}
                disabled={isSaving}
              >
                <option value="custom">Custom</option>
                <option value="performance">Performance</option>
                <option value="functional">Functional</option>
              </SelectField>
              <TextField
                label="Use Cases (comma separated)"
                value={draft.useCasesText}
                onChange={(event) => onDraftChange((current) => ({ ...current, useCasesText: event.target.value }))}
                placeholder="functional, performance"
                disabled={isSaving}
              />
            </div>
            <TextField
              label="Tags (comma separated)"
              value={draft.tagsText}
              onChange={(event) => onDraftChange((current) => ({ ...current, tagsText: event.target.value }))}
              placeholder="prod-like, k8s"
              disabled={isSaving}
            />
            <TextareaField
              label="Description"
              value={draft.description}
              onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))}
              textareaClassName="min-h-24"
              disabled={isSaving}
            />
            <details className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">Advanced settings</summary>
              <div className="mt-3 space-y-3">
                <TextareaField
                  label="Meta (JSON)"
                  value={draft.metaJson}
                  onChange={(event) => onDraftChange((current) => ({ ...current, metaJson: event.target.value }))}
                  textareaClassName="min-h-24 font-mono text-xs"
                  disabled={isSaving}
                />
                <TextareaField
                  label="Extra (JSON)"
                  value={draft.extraJson}
                  onChange={(event) => onDraftChange((current) => ({ ...current, extraJson: event.target.value }))}
                  textareaClassName="min-h-24 font-mono text-xs"
                  disabled={isSaving}
                />
              </div>
            </details>
          </div>
        ) : null}

        {activeStep === "hosts" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">Hosts</div>
                <div className="text-xs text-[var(--muted-foreground)]">{draft.hosts.length} host(s) added</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setHostEditor({ mode: "create", index: null, value: createEmptyEnvironmentHostDraft() });
                  setHostEditorError(null);
                }}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5" />
                Add host
              </Button>
            </div>

            {hostEditor ? (
              <div className="rounded-lg border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] p-3">
                <div className="mb-3 text-sm font-medium text-[var(--foreground)]">
                  {hostEditor.mode === "create" ? "Add host" : "Edit host"}
                </div>

                {hostEditorError ? (
                  <div className="mb-3 rounded-md border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] px-3 py-2 text-sm text-[var(--status-failure)]">
                    {hostEditorError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Host Name"
                    value={hostEditor.value.name}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, name: value } } : current,
                      );
                    }}
                    placeholder="api-node-1"
                    disabled={isSaving}
                  />
                  <SelectField
                    label="Host Type"
                    value={hostEditor.value.hostType}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, hostType: value } } : current,
                      );
                    }}
                    disabled={isSaving}
                  >
                    {ENVIRONMENT_HOST_TYPE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Placement"
                    value={hostEditor.value.placement}
                    onChange={(event) => {
                      const value = event.target.value as EnvironmentHostDraft["placement"];
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, placement: value } } : current,
                      );
                    }}
                    disabled={isSaving}
                  >
                    {ENVIRONMENT_HOST_PLACEMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Count"
                    value={hostEditor.value.count}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, count: value } } : current,
                      );
                    }}
                    disabled={isSaving}
                  />
                  <TextField
                    label="Provider"
                    value={hostEditor.value.provider}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, provider: value } } : current,
                      );
                    }}
                    placeholder="aws"
                    disabled={isSaving}
                  />
                  <TextField
                    label="Region"
                    value={hostEditor.value.region}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, region: value } } : current,
                      );
                    }}
                    placeholder="eu-central-1"
                    disabled={isSaving}
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Component Name"
                    value={hostEditor.value.componentName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, componentName: value } } : current,
                      );
                    }}
                    placeholder="payment-api"
                    disabled={isSaving}
                  />
                  <TextField
                    label="Component Type"
                    value={hostEditor.value.componentType}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, componentType: value } } : current,
                      );
                    }}
                    placeholder="api"
                    disabled={isSaving}
                  />
                  <TextField
                    label="Host Endpoint"
                    value={hostEditor.value.endpoint}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, endpoint: value } } : current,
                      );
                    }}
                    placeholder="https://api.staging.local"
                    disabled={isSaving}
                  />
                  <TextField
                    label="Role"
                    value={hostEditor.value.role}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHostEditor((current) =>
                        current ? { ...current, value: { ...current.value, role: value } } : current,
                      );
                    }}
                    placeholder="primary"
                    disabled={isSaving}
                  />
                </div>

                <details className="mt-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">Advanced settings</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Host Tags (comma separated)"
                      value={hostEditor.value.tagsText}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, tagsText: value } } : current,
                        );
                      }}
                      disabled={isSaving}
                    />
                    <TextField
                      label="Component Tags (comma separated)"
                      value={hostEditor.value.componentTagsText}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, componentTagsText: value } } : current,
                        );
                      }}
                      disabled={isSaving}
                    />
                    <TextField
                      label="Component Endpoints (comma separated)"
                      value={hostEditor.value.componentEndpointsText}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, componentEndpointsText: value } } : current,
                        );
                      }}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <TextareaField
                      label="Resources (JSON)"
                      value={hostEditor.value.resourcesJson}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, resourcesJson: value } } : current,
                        );
                      }}
                      textareaClassName="min-h-24 font-mono text-xs"
                      disabled={isSaving}
                    />
                    <TextareaField
                      label="Host Metadata (JSON)"
                      value={hostEditor.value.metadataJson}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, metadataJson: value } } : current,
                        );
                      }}
                      textareaClassName="min-h-24 font-mono text-xs"
                      disabled={isSaving}
                    />
                    <TextareaField
                      label="Component Metadata (JSON)"
                      value={hostEditor.value.componentMetadataJson}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostEditor((current) =>
                          current ? { ...current, value: { ...current.value, componentMetadataJson: value } } : current,
                        );
                      }}
                      textareaClassName="min-h-24 font-mono text-xs"
                      disabled={isSaving}
                    />
                  </div>
                </details>

                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHostEditor(null);
                      setHostEditorError(null);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={saveHostEditor} disabled={isSaving}>
                    {hostEditor.mode === "create" ? "Add host" : "Save host"}
                  </Button>
                </div>
              </div>
            ) : null}

            {draft.hosts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_70%)] px-4 py-10 text-center">
                <div className="text-sm font-medium text-[var(--foreground)]">No hosts yet</div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">Add your first host to define environment topology.</div>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHostEditor({ mode: "create", index: null, value: createEmptyEnvironmentHostDraft() });
                      setHostEditorError(null);
                    }}
                    disabled={isSaving}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add first host
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {draft.hosts.map((host, index) => {
                  const normalizedName = host.name.trim().toLowerCase();
                  const hasDuplicateName = normalizedName.length > 0 && hostsValidation.duplicateNames.has(normalizedName);
                  const hasFieldError = hostsValidation.invalidHostIds.has(host.id);
                  return (
                    <div key={host.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--foreground)]">{host.name.trim() || `Host ${index + 1}`}</div>
                          <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{buildHostSummary(host)}</div>
                          {host.endpoint.trim() ? (
                            <div className="mt-1 text-xs text-[var(--foreground)]">Endpoint: {host.endpoint.trim()}</div>
                          ) : null}
                          {hasDuplicateName ? (
                            <div className="mt-1 text-xs text-[var(--status-failure)]">Duplicate host name.</div>
                          ) : null}
                          {hasFieldError ? (
                            <div className="mt-1 text-xs text-[var(--status-failure)]">Required fields are missing or invalid.</div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setHostEditor({ mode: "edit", index, value: { ...host } });
                              setHostEditorError(null);
                            }}
                            disabled={isSaving}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              onDraftChange((current) => {
                                const source = current.hosts[index];
                                if (!source) return current;
                                const duplicated = cloneEnvironmentHostDraft({
                                  ...source,
                                  name: source.name.trim() ? `${source.name.trim()} copy` : source.name,
                                });
                                return { ...current, hosts: [...current.hosts, duplicated] };
                              });
                            }}
                            disabled={isSaving}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              onDraftChange((current) => ({
                                ...current,
                                hosts: current.hosts.filter((_, hostIndex) => hostIndex !== index),
                              }));
                            }}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hostsTouched && hostsValidation.missingHosts ? (
              <div className="rounded-md border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] px-3 py-2 text-sm text-[var(--status-failure)]">
                Add at least one host before continuing.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeStep === "review" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="text-sm font-medium text-[var(--foreground)]">Summary</div>
              <div className="mt-2 grid gap-2 text-sm text-[var(--foreground)] sm:grid-cols-2">
                <div>
                  Name: <span className="font-medium">{draft.name.trim() || "-"}</span>
                </div>
                <div>
                  Status: <span className="font-medium">{draft.status || "active"}</span>
                </div>
                <div>
                  Kind: <span className="font-medium">{draft.kind || "custom"}</span>
                </div>
                <div>
                  Hosts: <span className="font-medium">{draft.hosts.length}</span>
                </div>
              </div>
            </div>

            {!reviewValid ? (
              <div className="rounded-lg border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] p-3">
                <div className="text-sm font-medium text-[var(--status-failure)]">Needs attention</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--status-failure)]">
                  {reviewIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--tone-success-border)] bg-[var(--tone-success-bg-soft)] p-3 text-sm text-[var(--status-passed)]">
                Review passed. Environment is ready to {isCreating ? "create" : "save"}.
              </div>
            )}

            <div className="space-y-3">
              {ENVIRONMENT_HOST_PLACEMENT_OPTIONS.map((section) => {
                const hosts = hostsByPlacement[section.value];
                return (
                  <div key={section.value} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {section.label} ({hosts.length})
                    </div>
                    {hosts.length === 0 ? (
                      <div className="mt-2 text-xs text-[var(--muted-foreground)]">No hosts.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {hosts.map((host) => (
                          <div key={host.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
                            <div className="font-medium text-[var(--foreground)]">{host.name.trim() || "-"}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">{buildHostSummary(host)}</div>
                            {host.endpoint.trim() ? (
                              <div className="mt-1 text-xs text-[var(--foreground)]">Endpoint: {host.endpoint.trim()}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </WizardModalLayout>
    </AppModal>
  );
}
