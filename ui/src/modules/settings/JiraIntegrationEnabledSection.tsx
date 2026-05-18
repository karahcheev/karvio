import type { JiraProjectMappingDto, ProjectDto } from "@/shared/api";
import type React from "react";
import { Pencil, Plus } from "lucide-react";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { Button } from "@/shared/ui/Button";
import { SidePanel, SidePanelSection } from "@/shared/ui/SidePanel";
import { Switch } from "@/shared/ui/Switch";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { JiraFieldLabel } from "./jira-field-label";

export type JiraSystemFormStateForSection = {
  enabled: boolean;
  api_token_site_url: string;
  api_token_email: string;
  api_base_url: string;
  http_timeout_seconds: string;
  http_max_retries: string;
  sync_default_interval_seconds: string;
};

export type JiraIntegrationEnabledSectionProps = Readonly<{
  apiTokenConfigured: boolean;
  apiTokenInput: string;
  canManageMappings: boolean;
  componentsInput: string;
  createMappingPending: boolean;
  defaultIssueTypeId: string;
  deleteMappingPending: boolean;
  isAdmin: boolean;
  isConnectionActionPending: boolean;
  jiraProjectKey: string;
  labelsInput: string;
  mapping: JiraProjectMappingDto | null;
  mappingActive: boolean;
  mappings: JiraProjectMappingDto[];
  mappingsLoading: boolean;
  onCheckConnection: () => void | Promise<void>;
  onDeleteMapping: () => void | Promise<void>;
  onSaveMapping: () => void | Promise<void>;
  patchMappingPending: boolean;
  projects: ProjectDto[];
  selectedProjectId: string;
  setApiTokenInput: (value: string) => void;
  setComponentsInput: (value: string) => void;
  setDefaultIssueTypeId: (value: string) => void;
  setJiraProjectKey: (value: string) => void;
  setLabelsInput: (value: string) => void;
  setMappingActive: (value: boolean) => void;
  setSelectedProjectId: (value: string) => void;
  setSystemForm: React.Dispatch<React.SetStateAction<JiraSystemFormStateForSection>>;
  systemForm: JiraSystemFormStateForSection;
}>;

type JiraMappingTableItem = Readonly<{
  project: ProjectDto;
  mapping: JiraProjectMappingDto | null;
}>;

type JiraMappingColumn = "project" | "status" | "jiraProject" | "issueType" | "labels" | "components";

function MappingStatusBadge({ mapping }: Readonly<{ mapping: JiraProjectMappingDto | null }>) {
  if (!mapping) {
    return (
      <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
        Not configured
      </span>
    );
  }
  return mapping.active ? (
    <span className="inline-flex rounded-full border border-[var(--tone-success-border)] bg-[var(--tone-success-bg-soft)] px-2 py-0.5 text-xs text-[var(--tone-success-text)]">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] px-2 py-0.5 text-xs text-[var(--tone-warning-text)]">
      Inactive
    </span>
  );
}

function MutedDash() {
  return <span className="text-[var(--muted-foreground)]">-</span>;
}

function ListCell({ values }: Readonly<{ values: string[] }>) {
  if (values.length === 0) return <MutedDash />;
  return <span className="truncate">{values.join(", ")}</span>;
}

const MAPPING_TABLE_COLUMNS: UnifiedTableColumn<JiraMappingTableItem, JiraMappingColumn>[] = [
  {
    id: "project",
    label: "Project",
    menuLabel: "Project",
    locked: true,
    defaultWidth: 200,
    minWidth: 140,
    renderCell: (item) => <span className="font-medium">{item.project.name}</span>,
  },
  {
    id: "status",
    label: "Status",
    menuLabel: "Status",
    defaultWidth: 130,
    minWidth: 120,
    renderCell: (item) => <MappingStatusBadge mapping={item.mapping} />,
  },
  {
    id: "jiraProject",
    label: "Jira project",
    menuLabel: "Jira project",
    defaultWidth: 130,
    minWidth: 110,
    renderCell: (item) =>
      item.mapping ? <span className="font-mono text-xs">{item.mapping.jira_project_key}</span> : <MutedDash />,
  },
  {
    id: "issueType",
    label: "Issue type",
    menuLabel: "Issue type",
    defaultWidth: 130,
    minWidth: 110,
    renderCell: (item) =>
      item.mapping?.default_issue_type_id ? (
        <span className="font-mono text-xs">{item.mapping.default_issue_type_id}</span>
      ) : (
        <MutedDash />
      ),
  },
  {
    id: "labels",
    label: "Labels",
    menuLabel: "Labels",
    defaultWidth: 180,
    minWidth: 120,
    renderCell: (item) => <ListCell values={item.mapping?.default_labels ?? []} />,
  },
  {
    id: "components",
    label: "Components",
    menuLabel: "Components",
    defaultWidth: 180,
    minWidth: 120,
    renderCell: (item) => <ListCell values={item.mapping?.default_components ?? []} />,
  },
];

export function JiraIntegrationEnabledSection({
  apiTokenConfigured,
  apiTokenInput,
  canManageMappings,
  componentsInput,
  createMappingPending,
  defaultIssueTypeId,
  deleteMappingPending,
  isAdmin,
  isConnectionActionPending,
  jiraProjectKey,
  labelsInput,
  mapping,
  mappingActive,
  mappings,
  mappingsLoading,
  onCheckConnection,
  onDeleteMapping,
  onSaveMapping,
  patchMappingPending,
  projects,
  selectedProjectId,
  setApiTokenInput,
  setComponentsInput,
  setDefaultIssueTypeId,
  setJiraProjectKey,
  setLabelsInput,
  setMappingActive,
  setSelectedProjectId,
  setSystemForm,
  systemForm,
}: JiraIntegrationEnabledSectionProps) {
  const mappingByProjectId = new Map(mappings.map((item) => [item.project_id, item]));
  const mappingItems = projects.map((project) => ({
    project,
    mapping: mappingByProjectId.get(project.id) ?? null,
  }));
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <>
      {isAdmin ? (
        <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Jira setup</h3>
            <Button
              unstyled
              type="button"
              onClick={() => invokeMaybeAsync(onCheckConnection)}
              disabled={isConnectionActionPending || !systemForm.enabled}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-60"
            >
              {isConnectionActionPending ? "Checking..." : "Check connection"}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)] md:col-span-2">
              <JiraFieldLabel
                label="Jira Site URL"
                description="Your Jira Cloud site URL, for example https://your-site.atlassian.net."
              />
              <input
                value={systemForm.api_token_site_url}
                onChange={(event) =>
                  setSystemForm((current) => ({ ...current, api_token_site_url: event.target.value }))
                }
                placeholder="https://your-site.atlassian.net"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="Jira Account Email"
                description="Atlassian account email used with API token authentication."
              />
              <input
                value={systemForm.api_token_email}
                onChange={(event) =>
                  setSystemForm((current) => ({ ...current, api_token_email: event.target.value }))
                }
                placeholder="name@company.com"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="API Token"
                description="Atlassian API token. Leave empty to keep existing token."
              />
              <input
                type="password"
                value={apiTokenInput}
                onChange={(event) => setApiTokenInput(event.target.value)}
                placeholder={apiTokenConfigured ? "Leave empty to keep current token" : ""}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="API Base URL"
                description="Base URL for Jira API requests. Default is https://api.atlassian.com."
              />
              <input
                value={systemForm.api_base_url}
                onChange={(event) => setSystemForm((current) => ({ ...current, api_base_url: event.target.value }))}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="HTTP Timeout (seconds)"
                description="Request timeout for Jira API calls."
              />
              <input
                value={systemForm.http_timeout_seconds}
                onChange={(event) =>
                  setSystemForm((current) => ({ ...current, http_timeout_seconds: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="HTTP Max Retries"
                description="How many times failed Jira API requests are retried."
              />
              <input
                value={systemForm.http_max_retries}
                onChange={(event) => setSystemForm((current) => ({ ...current, http_max_retries: event.target.value }))}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              <JiraFieldLabel
                label="Sync Interval (seconds)"
                description="Default background sync interval for Jira issue snapshots."
              />
              <input
                value={systemForm.sync_default_interval_seconds}
                onChange={(event) =>
                  setSystemForm((current) => ({ ...current, sync_default_interval_seconds: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
              />
            </label>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)] p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Project mappings</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Select a project row to create or update its Jira mapping.
          </p>
        </div>
        <UnifiedTable<JiraMappingTableItem, JiraMappingColumn>
          items={mappingsLoading ? [] : mappingItems}
          columns={MAPPING_TABLE_COLUMNS}
          tableName="Jira project mappings"
          className="mb-4 p-0 bg-transparent"
          getRowId={(item) => item.project.id}
          onRowClick={(item) => setSelectedProjectId(item.project.id)}
          rowClassName={(item) => (item.project.id === selectedProjectId ? "bg-[var(--accent)]" : undefined)}
          pagination={{ enabled: false }}
          actions={{
            render: (item) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedProjectId(item.project.id);
                }}
                aria-label={`${item.mapping ? "Edit" : "Create"} Jira mapping for ${item.project.name}`}
              >
                {item.mapping ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            ),
          }}
          footer={
            !mappingsLoading && mappingItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                No projects available for Jira mapping.
              </div>
            ) : undefined
          }
        />
      </section>

      {selectedProject ? (
        <SidePanel
          title={selectedProject.name}
          onClose={() => setSelectedProjectId("")}
          className="w-full sm:w-[480px]"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              {!canManageMappings ? (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Mapping edit requires project lead/manager or workspace admin role.
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                {mapping ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="panel"
                    onClick={() => invokeMaybeAsync(onDeleteMapping)}
                    disabled={!canManageMappings || deleteMappingPending}
                  >
                    Delete mapping
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="panel"
                  onClick={() => setSelectedProjectId("")}
                  disabled={createMappingPending || patchMappingPending || deleteMappingPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="panel"
                  onClick={() => invokeMaybeAsync(onSaveMapping)}
                  disabled={!canManageMappings || createMappingPending || patchMappingPending}
                >
                  {mapping ? "Update mapping" : "Create mapping"}
                </Button>
              </div>
            </div>
          }
        >
          <SidePanelSection
            title="Mapping settings"
            description="Configure where Jira issues are created or linked for this TMS project."
          >
            <div className="grid grid-cols-1 gap-4">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                <JiraFieldLabel
                  label="Jira project key"
                  description="Target Jira project key where issues should be created or linked."
                />
                <input
                  value={jiraProjectKey}
                  onChange={(event) => setJiraProjectKey(event.target.value.toUpperCase())}
                  placeholder="e.g. QA"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                <JiraFieldLabel
                  label="Default issue type id"
                  description="Jira issue type ID used by default for auto-created issues."
                />
                <input
                  value={defaultIssueTypeId}
                  onChange={(event) => setDefaultIssueTypeId(event.target.value)}
                  placeholder="e.g. 10004"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                <JiraFieldLabel
                  label="Default labels"
                  description="Comma-separated Jira labels automatically added to created issues."
                />
                <input
                  value={labelsInput}
                  onChange={(event) => setLabelsInput(event.target.value)}
                  placeholder="regression, failed-run"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                <JiraFieldLabel
                  label="Default components"
                  description="Comma-separated Jira components automatically added to created issues."
                />
                <input
                  value={componentsInput}
                  onChange={(event) => setComponentsInput(event.target.value)}
                  placeholder="ui, backend"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2">
                <span className="text-sm text-[var(--foreground)]">
                  <JiraFieldLabel
                    label="Mapping active"
                    description="When disabled, Jira mapping exists but is not used for this project."
                  />
                </span>
                <Switch checked={mappingActive} onCheckedChange={setMappingActive} />
              </label>
            </div>
          </SidePanelSection>
        </SidePanel>
      ) : null}
    </>
  );
}
