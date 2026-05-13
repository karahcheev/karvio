import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type JiraProjectMappingDto,
  type JiraSystemSettingsDto,
  useConnectJiraViaApiTokenMutation,
  useCreateJiraMappingMutation,
  useDeleteJiraConnectionMutation,
  useDeleteJiraMappingMutation,
  useJiraConnectionsQuery,
  useJiraMappingsQuery,
  useJiraSystemSettingsQuery,
  usePatchJiraMappingMutation,
  useProjectsQuery,
  useUpsertJiraSystemSettingsMutation,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button, Switch } from "@/shared/ui";
import { JiraFieldLabel } from "./jira-field-label";
import { JiraIntegrationEnabledSection } from "./JiraIntegrationEnabledSection";

function parseListValue(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toInputList(value: string[] | undefined): string {
  return (value ?? []).join(", ");
}

type JiraSystemFormState = {
  enabled: boolean;
  api_token_site_url: string;
  api_token_email: string;
  api_base_url: string;
  http_timeout_seconds: string;
  http_max_retries: string;
  sync_default_interval_seconds: string;
};

const DEFAULT_SYSTEM_FORM: JiraSystemFormState = {
  enabled: false,
  api_token_site_url: "",
  api_token_email: "",
  api_base_url: "https://api.atlassian.com",
  http_timeout_seconds: "20",
  http_max_retries: "4",
  sync_default_interval_seconds: "300",
};

function validateJiraSystemSettingsForm(
  systemForm: JiraSystemFormState,
  apiTokenInput: string,
  apiTokenConfigured: boolean,
): boolean {
  if (systemForm.enabled) {
    const hasApiToken = apiTokenInput.trim().length > 0 || apiTokenConfigured;
    if (!systemForm.api_token_site_url.trim() || !systemForm.api_token_email.trim() || !hasApiToken) {
      notifyError("Site URL, account email and API token are required.", "Validation error.");
      return false;
    }
  }
  return true;
}

function isJiraSystemFormDirtyComparedToServer(
  systemForm: JiraSystemFormState,
  data: JiraSystemSettingsDto,
  apiTokenInput: string,
): boolean {
  return (
    systemForm.enabled !== data.enabled ||
    systemForm.api_token_site_url.trim() !== (data.api_token_site_url ?? "").trim() ||
    systemForm.api_token_email.trim() !== (data.api_token_email ?? "").trim() ||
    systemForm.api_base_url.trim() !== (data.api_base_url ?? "").trim() ||
    Number(systemForm.http_timeout_seconds || 0) !== Number(data.http_timeout_seconds) ||
    Number(systemForm.http_max_retries || 0) !== Number(data.http_max_retries) ||
    Number(systemForm.sync_default_interval_seconds || 0) !== Number(data.sync_default_interval_seconds) ||
    apiTokenInput.trim().length > 0
  );
}

export function JiraIntegrationsSettingsContent() {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === "admin";

  const projectsQuery = useProjectsQuery();
  const systemSettingsQuery = useJiraSystemSettingsQuery(isAdmin);
  const upsertSystemSettingsMutation = useUpsertJiraSystemSettingsMutation();
  const connectViaApiTokenMutation = useConnectJiraViaApiTokenMutation();
  const connectionsQuery = useJiraConnectionsQuery();
  const deleteConnectionMutation = useDeleteJiraConnectionMutation();
  const createMappingMutation = useCreateJiraMappingMutation();
  const patchMappingMutation = usePatchJiraMappingMutation();
  const deleteMappingMutation = useDeleteJiraMappingMutation();

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const connections = useMemo(() => connectionsQuery.data ?? [], [connectionsQuery.data]);
  const [systemForm, setSystemForm] = useState<JiraSystemFormState>(DEFAULT_SYSTEM_FORM);
  const [apiTokenInput, setApiTokenInput] = useState("");
  const [apiTokenConfigured, setApiTokenConfigured] = useState(false);

  const applySystemSettingsFromServer = useCallback((data: JiraSystemSettingsDto) => {
    setSystemForm({
      enabled: data.enabled,
      api_token_site_url: data.api_token_site_url ?? "",
      api_token_email: data.api_token_email ?? "",
      api_base_url: data.api_base_url ?? DEFAULT_SYSTEM_FORM.api_base_url,
      http_timeout_seconds: String(data.http_timeout_seconds ?? Number(DEFAULT_SYSTEM_FORM.http_timeout_seconds)),
      http_max_retries: String(data.http_max_retries ?? Number(DEFAULT_SYSTEM_FORM.http_max_retries)),
      sync_default_interval_seconds: String(
        data.sync_default_interval_seconds ?? Number(DEFAULT_SYSTEM_FORM.sync_default_interval_seconds),
      ),
    });
    setApiTokenInput("");
    setApiTokenConfigured(Boolean(data.api_token_configured));
  }, []);

  useEffect(() => {
    if (!systemSettingsQuery.data) return;
    applySystemSettingsFromServer(systemSettingsQuery.data);
  }, [applySystemSettingsFromServer, systemSettingsQuery.data]);

  const persistedIntegrationEnabled = useMemo(() => {
    if (isAdmin && systemSettingsQuery.data) return Boolean(systemSettingsQuery.data.enabled);
    return connections.some((item) => item.enabled);
  }, [connections, isAdmin, systemSettingsQuery.data]);
  const integrationEnabled = isAdmin ? systemForm.enabled : persistedIntegrationEnabled;
  const mappingsQuery = useJiraMappingsQuery(undefined, integrationEnabled);
  const mappings = useMemo(() => mappingsQuery.data ?? [], [mappingsQuery.data]);
  const mappingByProjectId = useMemo(() => {
    const byProjectId = new Map<string, JiraProjectMappingDto>();
    for (const item of mappings) {
      byProjectId.set(item.project_id, item);
    }
    return byProjectId;
  }, [mappings]);
  const mapping = selectedProjectId ? (mappingByProjectId.get(selectedProjectId) ?? null) : null;

  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [defaultIssueTypeId, setDefaultIssueTypeId] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [componentsInput, setComponentsInput] = useState("");
  const [mappingActive, setMappingActive] = useState(true);

  useEffect(() => {
    if (mapping) {
      setJiraProjectKey(mapping.jira_project_key ?? "");
      setDefaultIssueTypeId(mapping.default_issue_type_id ?? "");
      setLabelsInput(toInputList(mapping.default_labels));
      setComponentsInput(toInputList(mapping.default_components));
      setMappingActive(mapping.active);
      return;
    }
    setJiraProjectKey("");
    setDefaultIssueTypeId("");
    setLabelsInput("");
    setComponentsInput("");
    setMappingActive(true);
  }, [mapping?.id, mapping]);

  const selectedProjectRole = useMemo(() => {
    if (isAdmin) return "manager";
    if (!selectedProjectId) return null;
    return sessionUser?.project_memberships.find((item) => item.project_id === selectedProjectId)?.role ?? null;
  }, [isAdmin, selectedProjectId, sessionUser?.project_memberships]);
  const canManageMappings = isAdmin || selectedProjectRole === "lead" || selectedProjectRole === "manager";

  const isSystemSettingsDirty = useMemo(() => {
    if (!isAdmin || !systemSettingsQuery.data) return false;
    return isJiraSystemFormDirtyComparedToServer(systemForm, systemSettingsQuery.data, apiTokenInput);
  }, [apiTokenInput, isAdmin, systemForm, systemSettingsQuery.data]);

  const isConnectionActionPending =
    upsertSystemSettingsMutation.isPending ||
    connectViaApiTokenMutation.isPending ||
    deleteConnectionMutation.isPending;

  const buildSystemSettingsPayload = () => ({
    enabled: systemForm.enabled,
    api_token_site_url: systemForm.api_token_site_url.trim(),
    api_token_email: systemForm.api_token_email.trim(),
    api_token: apiTokenInput.trim() || undefined,
    api_base_url: systemForm.api_base_url.trim(),
    http_timeout_seconds: Number(systemForm.http_timeout_seconds),
    http_max_retries: Number(systemForm.http_max_retries),
    sync_default_interval_seconds: Number(systemForm.sync_default_interval_seconds),
  });

  const buildDisabledSystemSettingsPayload = () => ({
    enabled: false,
    api_token_site_url: "",
    api_token_email: "",
    api_token: "",
    api_base_url: DEFAULT_SYSTEM_FORM.api_base_url,
    http_timeout_seconds: Number(DEFAULT_SYSTEM_FORM.http_timeout_seconds),
    http_max_retries: Number(DEFAULT_SYSTEM_FORM.http_max_retries),
    sync_default_interval_seconds: Number(DEFAULT_SYSTEM_FORM.sync_default_interval_seconds),
  });

  const saveSystemSettings = async ({ checkConnection }: { checkConnection: boolean }) => {
    if (!isAdmin) return;
    if (!validateJiraSystemSettingsForm(systemForm, apiTokenInput, apiTokenConfigured)) return;
    const payload = systemForm.enabled ? buildSystemSettingsPayload() : buildDisabledSystemSettingsPayload();

    try {
      await upsertSystemSettingsMutation.mutateAsync(payload);
      if (!payload.enabled) {
        for (const connection of connections) {
          await deleteConnectionMutation.mutateAsync(connection.id);
        }
        setSystemForm(DEFAULT_SYSTEM_FORM);
        setApiTokenInput("");
        setApiTokenConfigured(false);
        notifySuccess("Jira settings saved. Integration disabled and connections disconnected.");
        return;
      }

      await connectViaApiTokenMutation.mutateAsync();
      setApiTokenInput("");
      setApiTokenConfigured(true);
      notifySuccess(checkConnection ? "Jira connection check passed." : "Jira settings saved and connection verified.");
    } catch (error) {
      notifyError(error, checkConnection ? "Jira connection check failed." : "Failed to save Jira settings.");
    }
  };

  const handleSaveSystemSettings = async () => {
    await saveSystemSettings({ checkConnection: false });
  };

  const handleCheckConnection = async () => {
    if (!isAdmin) return;
    if (!systemForm.enabled) {
      notifyError("Enable Jira integration first.", "Validation error.");
      return;
    }
    await saveSystemSettings({ checkConnection: true });
  };

  const handleCancelSystemSettings = () => {
    if (!isAdmin) return;
    if (systemSettingsQuery.data) {
      applySystemSettingsFromServer(systemSettingsQuery.data);
      return;
    }
    setSystemForm(DEFAULT_SYSTEM_FORM);
    setApiTokenInput("");
    setApiTokenConfigured(false);
  };

  const handleSaveMapping = async () => {
    if (!selectedProjectId) return;
    if (!jiraProjectKey.trim()) {
      notifyError("Jira project key is required.", "Validation error.");
      return;
    }
    const connectionId = connections[0]?.id;
    if (!connectionId) {
      notifyError("Connect Jira first to configure mappings.", "Jira connection required.");
      return;
    }
    const payload = {
      project_id: selectedProjectId,
      jira_connection_id: connectionId,
      jira_project_key: jiraProjectKey.trim(),
      default_issue_type_id: defaultIssueTypeId.trim() || null,
      default_labels: parseListValue(labelsInput),
      default_components: parseListValue(componentsInput),
      active: mappingActive,
    };
    try {
      if (mapping) {
        await patchMappingMutation.mutateAsync({
          mappingId: mapping.id,
          payload: {
            jira_project_key: payload.jira_project_key,
            default_issue_type_id: payload.default_issue_type_id,
            default_labels: payload.default_labels,
            default_components: payload.default_components,
            active: payload.active,
          },
        });
        notifySuccess("Jira project mapping updated.");
      } else {
        await createMappingMutation.mutateAsync(payload);
        notifySuccess("Jira project mapping created.");
      }
      setSelectedProjectId("");
    } catch (error) {
      notifyError(error, "Failed to save Jira mapping.");
    }
  };

  const handleDeleteMapping = async () => {
    if (!mapping || !selectedProjectId) return;
    try {
      await deleteMappingMutation.mutateAsync({ mappingId: mapping.id, projectId: selectedProjectId });
      notifySuccess("Jira mapping deleted.");
      setSelectedProjectId("");
    } catch (error) {
      notifyError(error, "Failed to delete Jira mapping.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Integrations - Jira</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Connect Jira Cloud, map projects, and monitor sync health.</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] p-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={integrationEnabled}
            onCheckedChange={(checked) => setSystemForm((current) => ({ ...current, enabled: checked }))}
            disabled={!isAdmin || isConnectionActionPending}
          />
          <span className="text-sm text-[var(--muted-foreground)]">
            <JiraFieldLabel
              label="Enabled"
              description="Global Jira toggle. Save applies this state. Turning it off and saving disconnects all Jira connections."
            />
          </span>
        </div>
      </div>

      {integrationEnabled ? (
        <JiraIntegrationEnabledSection
          apiTokenConfigured={apiTokenConfigured}
          apiTokenInput={apiTokenInput}
          canManageMappings={canManageMappings}
          componentsInput={componentsInput}
          createMappingPending={createMappingMutation.isPending}
          defaultIssueTypeId={defaultIssueTypeId}
          deleteMappingPending={deleteMappingMutation.isPending}
          isAdmin={isAdmin}
          isConnectionActionPending={isConnectionActionPending}
          jiraProjectKey={jiraProjectKey}
          labelsInput={labelsInput}
          mapping={mapping}
          mappingActive={mappingActive}
          mappings={mappings}
          mappingsLoading={mappingsQuery.isLoading}
          onCheckConnection={handleCheckConnection}
          onDeleteMapping={handleDeleteMapping}
          onSaveMapping={handleSaveMapping}
          patchMappingPending={patchMappingMutation.isPending}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setApiTokenInput={setApiTokenInput}
          setComponentsInput={setComponentsInput}
          setDefaultIssueTypeId={setDefaultIssueTypeId}
          setJiraProjectKey={setJiraProjectKey}
          setLabelsInput={setLabelsInput}
          setMappingActive={setMappingActive}
          setSelectedProjectId={setSelectedProjectId}
          setSystemForm={setSystemForm}
          systemForm={systemForm}
        />
      ) : null}

      {isAdmin && isSystemSettingsDirty ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            {systemForm.enabled
              ? "Jira settings have unsaved changes."
              : "Jira is disabled. Save to apply this change and clear Jira settings."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelSystemSettings}
              disabled={isConnectionActionPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => invokeMaybeAsync(() => handleSaveSystemSettings())}
              disabled={isConnectionActionPending}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
