import { apiRequest } from "@/shared/api/client";
import type {
  NotificationChannel,
  NotificationRuleType,
  NotificationTestResultDto,
  ProjectNotificationSettingsDto,
  ProjectNotificationRuleSettingsDto,
  SmtpEnabledDto,
  SmtpSettingsDto,
} from "./types";

export type SmtpSettingsPayload = {
  enabled: boolean;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  from_email: string;
  from_name?: string | null;
  reply_to?: string | null;
  use_tls: boolean;
  use_starttls: boolean;
  timeout_seconds: number;
};

export type ProjectNotificationSettingsPayload = {
  project_id: string;
  test_run_report: ProjectNotificationRuleSettingsDto;
  alerting: ProjectNotificationRuleSettingsDto;
};

export async function getSmtpSettings(): Promise<SmtpSettingsDto> {
  return apiRequest<SmtpSettingsDto>("/settings/smtp");
}

export async function getSmtpEnabled(): Promise<SmtpEnabledDto> {
  return apiRequest<SmtpEnabledDto>("/settings/smtp");
}

export async function createSmtpSettings(payload: SmtpSettingsPayload): Promise<SmtpSettingsDto> {
  return apiRequest<SmtpSettingsDto>("/settings/smtp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSmtpSettings(payload: SmtpSettingsPayload): Promise<SmtpSettingsDto> {
  return apiRequest<SmtpSettingsDto>("/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testSmtpSettings(payload: {
  recipient_email: string;
  smtp?: SmtpSettingsPayload;
}): Promise<NotificationTestResultDto> {
  return apiRequest<NotificationTestResultDto>("/settings/smtp/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProjectNotificationSettings(projectId: string): Promise<ProjectNotificationSettingsDto> {
  const query = new URLSearchParams({ project_id: projectId });
  return apiRequest<ProjectNotificationSettingsDto>(`/settings/notifications?${query.toString()}`);
}

export async function createProjectNotificationSettings(
  payload: ProjectNotificationSettingsPayload,
): Promise<ProjectNotificationSettingsDto> {
  return apiRequest<ProjectNotificationSettingsDto>("/settings/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProjectNotificationSettings(
  payload: ProjectNotificationSettingsPayload,
): Promise<ProjectNotificationSettingsDto> {
  return apiRequest<ProjectNotificationSettingsDto>("/settings/notifications", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testProjectNotificationSettings(payload: {
  project_id: string;
  rule: NotificationRuleType;
  channel: NotificationChannel;
  recipient_email?: string | null;
}): Promise<NotificationTestResultDto> {
  return apiRequest<NotificationTestResultDto>("/settings/notifications/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
