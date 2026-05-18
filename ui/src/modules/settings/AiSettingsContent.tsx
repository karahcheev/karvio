import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Globe, Info, KeyRound, Pencil, Server } from "lucide-react";
import {
  useAiSettingsOverviewQuery,
  useDeleteProjectAiSettingsMutation,
  useGlobalAiSettingsQuery,
  useProjectAiSettingsQuery,
  useUpdateGlobalAiSettingsMutation,
  useUpdateProjectAiSettingsMutation,
  getProjectAiSettings,
  updateProjectAiSettings,
  queryKeys,
  type ProjectAiSettingsOverviewItemDto,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth/session";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button, SelectField, Switch, TextField } from "@/shared/ui";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { SidePanel } from "@/shared/ui/SidePanel";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/Tooltip";
import { EMPTY_AI_FORM, type AiSettingsFormState } from "./settings-types";

// ─── Info tooltip helper ─────────────────────────────────────────────────────

function InfoLabel({ label, tip }: Readonly<{ label: string; tip: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`About ${label}`}
            className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          {tip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

// ─── Shared form fields ──────────────────────────────────────────────────────

type AiFormFieldsProps = Readonly<{
  form: AiSettingsFormState;
  apiKeyConfigured: boolean;
  onChange: (update: Partial<AiSettingsFormState>) => void;
}>;

function AiFormFields({ form, apiKeyConfigured, onChange }: AiFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-[var(--foreground)]">Enable AI assistant</span>
            <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
              Projects inherit this setting unless overridden individually.
            </span>
          </span>
          <Switch checked={form.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
        </label>
      </div>

      {/* Provider + model */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={
            <InfoLabel label="Provider" tip="The AI service provider used for all AI features in this project." />
          }
          value={form.provider}
          onChange={() => onChange({ provider: "openai" })}
        >
          <option value="openai">OpenAI</option>
        </SelectField>
        <TextField
          label={
            <InfoLabel label="Model" tip="Model identifier sent to the provider, e.g. gpt-4o or gpt-4o-mini." />
          }
          value={form.model}
          placeholder="gpt-4o-mini"
          onChange={(event) => onChange({ model: event.target.value })}
        />
      </div>

      {/* API key */}
      <TextField
        label={
          <InfoLabel
            label="API key"
            tip="Your provider API key. It is stored encrypted on the server and never returned to the browser."
          />
        }
        type="password"
        value={form.apiKey}
        placeholder={apiKeyConfigured ? "Configured — leave blank to keep" : "sk-…"}
        onChange={(event) => onChange({ apiKey: event.target.value })}
      />

      {/* Advanced fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={
            <InfoLabel
              label="Timeout (ms)"
              tip="Maximum time in milliseconds to wait for a single AI response before aborting."
            />
          }
          type="number"
          min={1000}
          max={300000}
          value={form.timeoutMs}
          onChange={(event) => onChange({ timeoutMs: event.target.value })}
        />
        <TextField
          label={
            <InfoLabel
              label="Max retries"
              tip="How many times to retry a failed AI request before returning an error."
            />
          }
          type="number"
          min={0}
          max={10}
          value={form.httpMaxRetries}
          onChange={(event) => onChange({ httpMaxRetries: event.target.value })}
        />
        <TextField
          label={
            <InfoLabel
              label="High duplicate threshold"
              tip="Similarity score (0–1) above which two test cases are considered likely duplicates and flagged for merging."
            />
          }
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={form.duplicateHighThreshold}
          onChange={(event) => onChange({ duplicateHighThreshold: event.target.value })}
        />
        <TextField
          label={
            <InfoLabel
              label="Medium duplicate threshold"
              tip="Similarity score (0–1) above which two test cases are flagged for manual review. Must be ≤ the high threshold."
            />
          }
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={form.duplicateMediumThreshold}
          onChange={(event) => onChange({ duplicateMediumThreshold: event.target.value })}
        />
      </div>
    </div>
  );
}

function parseFormNumbers(form: AiSettingsFormState) {
  return {
    timeoutMs: Number.parseInt(form.timeoutMs, 10),
    httpMaxRetries: Number.parseInt(form.httpMaxRetries, 10),
    duplicateHighThreshold: Number.parseFloat(form.duplicateHighThreshold),
    duplicateMediumThreshold: Number.parseFloat(form.duplicateMediumThreshold),
  };
}

function mapSettingsToForm(
  data:
    | ReturnType<typeof useProjectAiSettingsQuery>["data"]
    | ReturnType<typeof useGlobalAiSettingsQuery>["data"],
): AiSettingsFormState {
  return {
    enabled: data?.enabled ?? EMPTY_AI_FORM.enabled,
    provider: "openai",
    model: data?.model ?? "",
    apiKey: "",
    timeoutMs: String(data?.timeout_ms ?? 30000),
    httpMaxRetries: String(data?.http_max_retries ?? 2),
    duplicateHighThreshold: String(data?.duplicate_high_threshold ?? 0.88),
    duplicateMediumThreshold: String(data?.duplicate_medium_threshold ?? 0.72),
  };
}

// ─── Panel footer ────────────────────────────────────────────────────────────

type PanelFooterProps = Readonly<{
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
  onReset?: () => void;
}>;

function PanelFooter({ isPending, onCancel, onSave, onReset }: PanelFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onReset ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isPending}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Use global settings
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            Remove the project override and inherit global or environment settings instead.
          </TooltipContent>
        </Tooltip>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Global settings panel ───────────────────────────────────────────────────

function GlobalAiSettingsPanel({ onClose }: Readonly<{ onClose: () => void }>) {
  const [form, setForm] = useState<AiSettingsFormState>(EMPTY_AI_FORM);
  const globalSettingsQuery = useGlobalAiSettingsQuery();
  const updateMutation = useUpdateGlobalAiSettingsMutation();

  useEffect(() => {
    setForm(mapSettingsToForm(globalSettingsQuery.data));
  }, [globalSettingsQuery.data]);

  const saveSettings = async () => {
    const { timeoutMs, httpMaxRetries, duplicateHighThreshold, duplicateMediumThreshold } =
      parseFormNumbers(form);
    if (
      Number.isNaN(timeoutMs) ||
      Number.isNaN(httpMaxRetries) ||
      Number.isNaN(duplicateHighThreshold) ||
      Number.isNaN(duplicateMediumThreshold)
    ) {
      notifyError("Numeric AI settings are invalid.", "Failed to save.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        enabled: form.enabled,
        provider: "openai",
        model: form.model.trim() || null,
        ...(form.apiKey.trim() ? { api_key: form.apiKey.trim() } : {}),
        timeout_ms: timeoutMs,
        http_max_retries: httpMaxRetries,
        duplicate_high_threshold: duplicateHighThreshold,
        duplicate_medium_threshold: duplicateMediumThreshold,
      });
      setForm((f) => ({ ...f, apiKey: "" }));
      notifySuccess("Global AI settings saved.");
      onClose();
    } catch (error) {
      notifyError(error, "Failed to save global AI settings.");
    }
  };

  return (
    <SidePanel
      title="Global AI settings"
      eyebrow={
        <span className="text-xs text-[var(--muted-foreground)]">
          Applied to all projects that have no project-specific configuration
        </span>
      }
      onClose={onClose}
      className="w-full sm:w-[480px]"
      footer={
        <PanelFooter
          isPending={updateMutation.isPending}
          onCancel={onClose}
          onSave={() => void saveSettings()}
        />
      }
    >
      <AiFormFields
        form={form}
        apiKeyConfigured={globalSettingsQuery.data?.api_key_configured ?? false}
        onChange={(update) => setForm((f) => ({ ...f, ...update }))}
      />
    </SidePanel>
  );
}

// ─── Project settings panel ──────────────────────────────────────────────────

type EditPanelProps = Readonly<{
  projectId: string;
  projectName: string;
  onClose: () => void;
}>;

function AiSettingsEditPanel({ projectId, projectName, onClose }: EditPanelProps) {
  const [form, setForm] = useState<AiSettingsFormState>(EMPTY_AI_FORM);
  const projectSettingsQuery = useProjectAiSettingsQuery(projectId, Boolean(projectId));
  const updateSettingsMutation = useUpdateProjectAiSettingsMutation();
  const deleteSettingsMutation = useDeleteProjectAiSettingsMutation();

  useEffect(() => {
    setForm(mapSettingsToForm(projectSettingsQuery.data));
  }, [projectSettingsQuery.data]);

  // "new" means no DB row yet — there's nothing to reset
  const hasOverride = projectSettingsQuery.data?.id !== "new" && projectSettingsQuery.data?.id != null;
  const isPending = updateSettingsMutation.isPending || deleteSettingsMutation.isPending;

  const saveSettings = async () => {
    const { timeoutMs, httpMaxRetries, duplicateHighThreshold, duplicateMediumThreshold } =
      parseFormNumbers(form);
    if (
      Number.isNaN(timeoutMs) ||
      Number.isNaN(httpMaxRetries) ||
      Number.isNaN(duplicateHighThreshold) ||
      Number.isNaN(duplicateMediumThreshold)
    ) {
      notifyError("Numeric AI settings are invalid.", "Failed to save.");
      return;
    }
    try {
      await updateSettingsMutation.mutateAsync({
        project_id: projectId,
        enabled: form.enabled,
        provider: "openai",
        model: form.model.trim() || null,
        ...(form.apiKey.trim() ? { api_key: form.apiKey.trim() } : {}),
        timeout_ms: timeoutMs,
        http_max_retries: httpMaxRetries,
        duplicate_high_threshold: duplicateHighThreshold,
        duplicate_medium_threshold: duplicateMediumThreshold,
      });
      setForm((f) => ({ ...f, apiKey: "" }));
      notifySuccess("AI settings saved.");
      onClose();
    } catch (error) {
      notifyError(error, "Failed to save AI settings.");
    }
  };

  const resetToGlobal = async () => {
    try {
      await deleteSettingsMutation.mutateAsync(projectId);
      notifySuccess("Project override removed. Global settings will apply.");
      onClose();
    } catch (error) {
      notifyError(error, "Failed to reset AI settings.");
    }
  };

  return (
    <SidePanel
      title={projectName}
      onClose={onClose}
      className="w-full sm:w-[480px]"
      footer={
        <PanelFooter
          isPending={isPending}
          onCancel={onClose}
          onSave={() => void saveSettings()}
          onReset={hasOverride ? () => void resetToGlobal() : undefined}
        />
      }
    >
      <AiFormFields
        form={form}
        apiKeyConfigured={projectSettingsQuery.data?.api_key_configured ?? false}
        onChange={(update) => setForm((f) => ({ ...f, ...update }))}
      />
    </SidePanel>
  );
}

// ─── Source badge ────────────────────────────────────────────────────────────

function SourceBadge({
  source,
}: Readonly<{ source: ProjectAiSettingsOverviewItemDto["effective_source"] }>) {
  if (source === "project") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] px-2 py-0.5 text-xs text-[var(--tone-info-text)]">
        <Server className="h-3 w-3" />
        Project
      </span>
    );
  }
  if (source === "global") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-2 py-0.5 text-xs text-[var(--tone-warning-text)]">
        <Globe className="h-3 w-3" />
        Global
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
      <Bot className="h-3 w-3" />
      Env
    </span>
  );
}

// ─── Inline enable toggle ────────────────────────────────────────────────────

type EnableToggleProps = Readonly<{
  item: ProjectAiSettingsOverviewItemDto;
}>;

function EnableToggle({ item }: EnableToggleProps) {
  const queryClient = useQueryClient();
  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      // Fetch full project settings (uses cache when available)
      const current = await queryClient.fetchQuery({
        queryKey: queryKeys.settings.ai(item.project_id),
        queryFn: () => getProjectAiSettings(item.project_id),
      });
      return updateProjectAiSettings({
        project_id: item.project_id,
        enabled: next,
        provider: current.provider,
        model: current.model,
        timeout_ms: current.timeout_ms,
        http_max_retries: current.http_max_retries,
        duplicate_high_threshold: current.duplicate_high_threshold,
        duplicate_medium_threshold: current.duplicate_medium_threshold,
        // no api_key → backend keeps the existing encrypted key
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.aiOverview });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.ai(data.project_id) });
    },
    onError: (error) => {
      notifyError(error, "Failed to update AI status.");
    },
  });

  // Only show an interactive toggle for projects that already have an override row.
  // For global/env sources, open the edit panel instead.
  if (!item.has_project_settings) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block cursor-default opacity-50">
            <Switch checked={item.enabled} disabled aria-label="AI enabled" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          Inheriting from {item.effective_source === "global" ? "global" : "env"} config. Click Edit to create a project override.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Switch
      checked={item.enabled}
      disabled={toggleMutation.isPending}
      onCheckedChange={(next) => void toggleMutation.mutate(next)}
      aria-label="Toggle AI for this project"
    />
  );
}

// ─── Column definitions ──────────────────────────────────────────────────────

type AiOverviewColumn = "project" | "status" | "source" | "provider" | "model" | "apiKey";

const TABLE_COLUMNS: UnifiedTableColumn<ProjectAiSettingsOverviewItemDto, AiOverviewColumn>[] = [
  {
    id: "project",
    label: "Project",
    menuLabel: "Project",
    locked: true,
    defaultWidth: 200,
    minWidth: 120,
    renderCell: (item) => <span className="font-medium">{item.project_name}</span>,
  },
  {
    id: "status",
    label: "Enabled",
    menuLabel: "Enabled",
    defaultWidth: 90,
    minWidth: 80,
    renderCell: (item) => (
      <span onClick={(e) => e.stopPropagation()}>
        <EnableToggle item={item} />
      </span>
    ),
  },
  {
    id: "source",
    label: "Source",
    menuLabel: "Source",
    defaultWidth: 110,
    minWidth: 90,
    renderCell: (item) => <SourceBadge source={item.effective_source} />,
  },
  {
    id: "provider",
    label: "Provider",
    menuLabel: "Provider",
    defaultWidth: 100,
    minWidth: 80,
    renderCell: (item) =>
      item.provider ?? <span className="text-[var(--muted-foreground)]">—</span>,
  },
  {
    id: "model",
    label: "Model",
    menuLabel: "Model",
    defaultWidth: 160,
    minWidth: 100,
    renderCell: (item) =>
      item.model ? (
        <span className="font-mono text-xs">{item.model}</span>
      ) : (
        <span className="text-[var(--muted-foreground)]">—</span>
      ),
  },
  {
    id: "apiKey",
    label: "API key",
    menuLabel: "API key",
    defaultWidth: 120,
    minWidth: 90,
    renderCell: (item) =>
      item.api_key_configured ? (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--tone-success-text)]">
          <KeyRound className="h-3 w-3" />
          Configured
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--tone-warning-text)]">
          <KeyRound className="h-3 w-3" />
          Not set
        </span>
      ),
  },
];

// ─── Main component ──────────────────────────────────────────────────────────

export function AiSettingsContent() {
  const { data, isLoading } = useAiSettingsOverviewQuery();
  const [selectedProject, setSelectedProject] = useState<ProjectAiSettingsOverviewItemDto | null>(
    null,
  );
  const [globalPanelOpen, setGlobalPanelOpen] = useState(false);

  const isAdmin = getSessionUser()?.role === "admin";
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">AI</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
            Configure server-side AI assistance per project. Project settings override the global
            config; projects without an override inherit from global or environment variables.
          </p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGlobalPanelOpen(true)}
            className="shrink-0"
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Global settings
          </Button>
        )}
      </div>

      <UnifiedTable<ProjectAiSettingsOverviewItemDto, AiOverviewColumn>
        items={isLoading ? [] : items}
        columns={TABLE_COLUMNS}
        className="p-0 bg-transparent"
        getRowId={(item) => item.project_id}
        onRowClick={(item) => setSelectedProject(item)}
        pagination={{ enabled: false }}
        actions={{
          render: (item) => (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(item);
              }}
              aria-label={`Edit AI settings for ${item.project_name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ),
        }}
        footer={
          !isLoading && items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No manageable projects found. AI settings are available to project managers and
              administrators.
            </div>
          ) : undefined
        }
      />

      {selectedProject && (
        <AiSettingsEditPanel
          projectId={selectedProject.project_id}
          projectName={selectedProject.project_name}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {globalPanelOpen && <GlobalAiSettingsPanel onClose={() => setGlobalPanelOpen(false)} />}
    </div>
  );
}
