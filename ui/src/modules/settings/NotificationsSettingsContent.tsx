import { useEffect, useMemo, useState } from "react";
import {
  createProjectNotificationSettings as createProjectNotificationSettingsRequest,
  getProjectNotificationSettings as getProjectNotificationSettingsRequest,
  updateProjectNotificationSettings as updateProjectNotificationSettingsRequest,
  useProjectNotificationSettingsQuery,
  useProjectsQuery,
  useSmtpEnabledQuery,
  useTestProjectNotificationSettingsMutation,
  type NotificationChannel,
  type ProjectDto,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { getLastProjectId, setLastProjectId } from "@/shared/lib/last-project";
import { getErrorMessage, notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button, SelectField } from "@/shared/ui";
import { NotificationRuleCard } from "./NotificationRuleCard";
import { isProjectNotificationSettingsNotFound } from "./notification-settings-errors";
import { EMPTY_RULE_FORM, mapRuleToForm, parseRecipients, ruleFormsEqual, type RuleFormState } from "./settings-types";

function isManageableProject(project: ProjectDto, sessionUser: ReturnType<typeof getSessionUser>): boolean {
  if (sessionUser?.role === "admin") {
    return true;
  }
  const membership = sessionUser?.project_memberships.find((item) => item.project_id === project.id);
  return membership?.role === "lead" || membership?.role === "manager";
}

export function NotificationsSettingsContent() {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === "admin";
  const { data: projects = [] } = useProjectsQuery();
  const manageableProjects = useMemo(
    () => projects.filter((project) => isManageableProject(project, sessionUser)),
    [projects, sessionUser],
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const projectContextId = isAdmin ? manageableProjects[0]?.id ?? "" : selectedProjectId;

  const projectSettingsQuery = useProjectNotificationSettingsQuery(
    projectContextId || undefined,
    Boolean(projectContextId),
  );
  const smtpEnabledQuery = useSmtpEnabledQuery();
  const testProjectSettingsMutation = useTestProjectNotificationSettingsMutation();

  const [testRunReportForm, setTestRunReportForm] = useState<RuleFormState>(EMPTY_RULE_FORM);

  useEffect(() => {
    if (!manageableProjects.length) {
      setSelectedProjectId("");
      return;
    }

    if (isAdmin) {
      setSelectedProjectId(manageableProjects[0].id);
      return;
    }

    const lastProjectId = getLastProjectId();
    const initialProject =
      manageableProjects.find((project) => project.id === lastProjectId) ?? manageableProjects[0];
    setSelectedProjectId((current) => current || initialProject.id);
  }, [isAdmin, manageableProjects]);

  useEffect(() => {
    if (!isAdmin && selectedProjectId) {
      setLastProjectId(selectedProjectId);
    }
  }, [isAdmin, selectedProjectId]);

  useEffect(() => {
    setTestRunReportForm(EMPTY_RULE_FORM);
  }, [projectContextId]);

  useEffect(() => {
    if (projectSettingsQuery.data) {
      setTestRunReportForm(mapRuleToForm(projectSettingsQuery.data.test_run_report));
    } else if (projectSettingsQuery.error) {
      setTestRunReportForm(EMPTY_RULE_FORM);
    }
  }, [projectSettingsQuery.data, projectSettingsQuery.error]);

  const savedTestRunReportForm = useMemo(
    () =>
      projectSettingsQuery.data
        ? mapRuleToForm(projectSettingsQuery.data.test_run_report)
        : EMPTY_RULE_FORM,
    [projectSettingsQuery.data],
  );

  const hasUnsavedNotificationChanges = useMemo(
    () => !ruleFormsEqual(testRunReportForm, savedTestRunReportForm),
    [testRunReportForm, savedTestRunReportForm],
  );

  const emailAvailable = smtpEnabledQuery.data?.enabled === true;

  const buildPayload = (projectId: string) => ({
    project_id: projectId,
    test_run_report: {
      enabled: testRunReportForm.enabled,
      email: {
        enabled: emailAvailable ? testRunReportForm.email.enabled : false,
        recipients: emailAvailable ? parseRecipients(testRunReportForm.email.recipients) : [],
      },
      slack: {
        enabled: testRunReportForm.slack.enabled,
        webhook_url: testRunReportForm.slack.webhook_url.trim() || null,
        channel_name: testRunReportForm.slack.channel_name.trim() || null,
      },
      mattermost: {
        enabled: testRunReportForm.mattermost.enabled,
        webhook_url: testRunReportForm.mattermost.webhook_url.trim() || null,
        channel_name: testRunReportForm.mattermost.channel_name.trim() || null,
      },
    },
    alerting: {
      enabled: false,
      email: {
        enabled: false,
        recipients: [],
      },
      slack: {
        enabled: false,
        webhook_url: null,
        channel_name: null,
      },
      mattermost: {
        enabled: false,
        webhook_url: null,
        channel_name: null,
      },
    },
  });

  const saveProjectNotificationSettings = async () => {
    if (!manageableProjects.length) return;

    try {
      const targetProjectIds = isAdmin ? manageableProjects.map((project) => project.id) : [selectedProjectId];

      for (const projectId of targetProjectIds) {
        if (!projectId) continue;
        const payload = buildPayload(projectId);
        try {
          await getProjectNotificationSettingsRequest(projectId);
          await updateProjectNotificationSettingsRequest(payload);
        } catch {
          await createProjectNotificationSettingsRequest(payload);
        }
      }

      notifySuccess(
        isAdmin
          ? "Notification settings saved for all projects."
          : "Project notification settings saved.",
      );
      await projectSettingsQuery.refetch();
    } catch (error) {
      notifyError(error, "Failed to save project notification settings.");
    }
  };

  const sendProjectTest = async (channel: NotificationChannel) => {
    if (!projectContextId) return;
    try {
      await testProjectSettingsMutation.mutateAsync({
        project_id: projectContextId,
        rule: "test_run_report",
        channel,
        recipient_email: null,
      });
      notifySuccess("Test notification sent.");
    } catch (error) {
      notifyError(error, "Failed to send test notification.");
    }
  };

  if (!manageableProjects.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-5 text-sm text-[var(--muted-foreground)]">
        Notification settings are available for project leads, managers, and administrators.
      </div>
    );
  }

  const projectSettingsError =
    projectSettingsQuery.error && !isProjectNotificationSettingsNotFound(projectSettingsQuery.error)
      ? getErrorMessage(projectSettingsQuery.error, "Notification settings are not configured yet.")
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Notifications</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
            Configure where the test run completion report should be delivered.
          </p>
        </div>
        {isAdmin ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
            These settings will be applied to all projects.
          </div>
        ) : (
          <div className="min-w-[18rem]">
            <SelectField label="Project" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {manageableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </div>

      <NotificationRuleCard
        title="Test run report"
        description="Send a completion report when a test run enters completed status."
        value={testRunReportForm}
        emailAvailable={emailAvailable}
        showEmailChannel={isAdmin || emailAvailable}
        onChange={setTestRunReportForm}
        onSendTest={sendProjectTest}
      />

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
        <p className="text-sm text-[var(--muted-foreground)]">
          {projectSettingsError ??
            (isAdmin
              ? "Administrators save one notification profile that is copied to every project."
              : "Only projects where you have lead or manager access are available here.")}
        </p>
        {hasUnsavedNotificationChanges ? (
          <Button type="button" onClick={saveProjectNotificationSettings}>
            Save Notifications
          </Button>
        ) : null}
      </div>
    </div>
  );
}
