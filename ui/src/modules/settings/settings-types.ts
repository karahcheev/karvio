import type { ProjectNotificationRuleSettingsDto } from "@/shared/api";

export const SETTINGS_TABS = ["notifications", "smtp", "integrations", "ai"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type SmtpFormState = {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  use_tls: boolean;
  use_starttls: boolean;
  timeout_seconds: string;
};

export type RuleFormState = {
  enabled: boolean;
  email: { enabled: boolean; recipients: string };
  slack: { enabled: boolean; webhook_url: string; channel_name: string };
  mattermost: { enabled: boolean; webhook_url: string; channel_name: string };
};

export type AiSettingsFormState = {
  enabled: boolean;
  provider: "openai";
  model: string;
  apiKey: string;
  timeoutMs: string;
  httpMaxRetries: string;
  duplicateHighThreshold: string;
  duplicateMediumThreshold: string;
};

export const EMPTY_AI_FORM: AiSettingsFormState = {
  enabled: false,
  provider: "openai",
  model: "",
  apiKey: "",
  timeoutMs: "30000",
  httpMaxRetries: "2",
  duplicateHighThreshold: "0.88",
  duplicateMediumThreshold: "0.72",
};

export const EMPTY_RULE_FORM: RuleFormState = {
  enabled: false,
  email: { enabled: false, recipients: "" },
  slack: { enabled: false, webhook_url: "", channel_name: "" },
  mattermost: { enabled: false, webhook_url: "", channel_name: "" },
};

export function mapSmtpToForm(data?: {
  enabled: boolean;
  host: string;
  port: number;
  username: string | null;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  use_tls: boolean;
  use_starttls: boolean;
  timeout_seconds: number;
}): SmtpFormState {
  return {
    enabled: data?.enabled ?? false,
    host: data?.host ?? "",
    port: data ? String(data.port) : "587",
    username: data?.username ?? "",
    password: "",
    from_email: data?.from_email ?? "",
    from_name: data?.from_name ?? "",
    reply_to: data?.reply_to ?? "",
    use_tls: data?.use_tls ?? false,
    use_starttls: data?.use_starttls ?? true,
    timeout_seconds: data ? String(data.timeout_seconds) : "30",
  };
}

export function ruleFormsEqual(a: RuleFormState, b: RuleFormState): boolean {
  return (
    a.enabled === b.enabled &&
    a.email.enabled === b.email.enabled &&
    a.email.recipients === b.email.recipients &&
    a.slack.enabled === b.slack.enabled &&
    a.slack.webhook_url === b.slack.webhook_url &&
    a.slack.channel_name === b.slack.channel_name &&
    a.mattermost.enabled === b.mattermost.enabled &&
    a.mattermost.webhook_url === b.mattermost.webhook_url &&
    a.mattermost.channel_name === b.mattermost.channel_name
  );
}

export function mapRuleToForm(rule?: ProjectNotificationRuleSettingsDto): RuleFormState {
  return {
    enabled: rule?.enabled ?? false,
    email: {
      enabled: rule?.email.enabled ?? false,
      recipients: rule?.email.recipients.join(", ") ?? "",
    },
    slack: {
      enabled: rule?.slack.enabled ?? false,
      webhook_url: rule?.slack.webhook_url ?? "",
      channel_name: rule?.slack.channel_name ?? "",
    },
    mattermost: {
      enabled: rule?.mattermost.enabled ?? false,
      webhook_url: rule?.mattermost.webhook_url ?? "",
      channel_name: rule?.mattermost.channel_name ?? "",
    },
  };
}

export function parseRecipients(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
