import { Mail } from "lucide-react";
import { Link } from "react-router";
import type { NotificationChannel } from "@/shared/api";
import { Button, Switch, TextareaField, TextField } from "@/shared/ui";
import type { RuleFormState } from "./settings-types";

function SlackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="var(--brand-slack-magenta)" d="M10.2 4.3a2.1 2.1 0 1 0-4.2 0v5.3a2.1 2.1 0 1 0 4.2 0z" />
      <path fill="var(--brand-slack-cyan)" d="M19.7 10.2a2.1 2.1 0 1 0 0-4.2h-5.3a2.1 2.1 0 1 0 0 4.2z" />
      <path fill="var(--brand-slack-green)" d="M13.8 19.7a2.1 2.1 0 1 0 4.2 0v-5.3a2.1 2.1 0 1 0-4.2 0z" />
      <path fill="var(--brand-slack-yellow)" d="M4.3 13.8a2.1 2.1 0 1 0 0 4.2h5.3a2.1 2.1 0 1 0 0-4.2z" />
      <path fill="var(--brand-slack-magenta)" d="M14.4 2a2.1 2.1 0 0 0 0 4.2h2.3v2.3a2.1 2.1 0 1 0 4.2 0V4.1A2.1 2.1 0 0 0 18.8 2z" />
      <path fill="var(--brand-slack-cyan)" d="M22 14.4a2.1 2.1 0 0 0-4.2 0v2.3h-2.3a2.1 2.1 0 1 0 0 4.2h4.4a2.1 2.1 0 0 0 2.1-2.1z" />
      <path fill="var(--brand-slack-green)" d="M9.6 22a2.1 2.1 0 1 0 0-4.2H7.3v-2.3a2.1 2.1 0 1 0-4.2 0v4.4A2.1 2.1 0 0 0 5.2 22z" />
      <path fill="var(--brand-slack-yellow)" d="M2 9.6a2.1 2.1 0 0 0 4.2 0V7.3h2.3a2.1 2.1 0 1 0 0-4.2H4.1A2.1 2.1 0 0 0 2 5.2z" />
    </svg>
  );
}

function MattermostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--brand-mattermost-bg)" />
      <path
        fill="var(--brand-mattermost-mark)"
        d="M8.3 16.7c.7.4 1.5.7 2.4.8l1.2-2.5c.1 0 .1 0 .2 0 .1 0 .2 0 .3 0l1.2 2.5c.9-.1 1.7-.4 2.4-.8l-1.1-2.2c.8-.7 1.3-1.8 1.3-3 0-2.2-1.8-4-4-4s-4 1.8-4 4c0 1.2.5 2.3 1.3 3z"
      />
      <circle cx="10.2" cy="11.2" r="1.1" fill="var(--brand-mattermost-bg)" />
      <circle cx="13.8" cy="11.2" r="1.1" fill="var(--brand-mattermost-bg)" />
    </svg>
  );
}

type NotificationRuleCardProps = Readonly<{
  title: string;
  description: string;
  value: RuleFormState;
  emailAvailable?: boolean;
  showEmailChannel?: boolean;
  onChange: (next: RuleFormState) => void;
  onSendTest: (channel: NotificationChannel) => void;
}>;

function NotificationRuleCardEnabledFields({
  value,
  emailAvailable,
  showEmailChannel,
  onChange,
  onSendTest,
}: Readonly<Pick<NotificationRuleCardProps, "value" | "emailAvailable" | "showEmailChannel" | "onChange" | "onSendTest">>) {
  return (
    <div className="space-y-5 border-t border-[var(--border)] pt-5">
      {showEmailChannel ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <Switch
              disabled={!emailAvailable}
              checked={value.email.enabled}
              onCheckedChange={(checked) => onChange({ ...value, email: { ...value.email, enabled: checked } })}
            />
          </div>
          {!emailAvailable ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Email notifications are available only after{" "}
              <Link
                to="/settings#smtp"
                className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
              >
                SMTP
              </Link>{" "}
              is configured by an administrator.
            </p>
          ) : null}
          {emailAvailable && value.email.enabled ? (
            <>
              <TextareaField
                hint="Comma-separated recipient list"
                value={value.email.recipients}
                onChange={(event) => onChange({ ...value, email: { ...value.email, recipients: event.target.value } })}
                placeholder="qa@example.com, lead@example.com"
                textareaClassName="min-h-28"
              />
              <Button type="button" variant="outline" onClick={() => onSendTest("email")}>
                Send Email Test
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          showEmailChannel ? "space-y-3 border-t border-[var(--border)] pt-5" : "space-y-3"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <SlackIcon />
            Slack webhook
          </div>
          <Switch
            checked={value.slack.enabled}
            onCheckedChange={(checked) => onChange({ ...value, slack: { ...value.slack, enabled: checked } })}
          />
        </div>
        {value.slack.enabled ? (
          <>
            <TextareaField
              hint="Incoming webhook URL"
              value={value.slack.webhook_url}
              onChange={(event) => onChange({ ...value, slack: { ...value.slack, webhook_url: event.target.value } })}
              placeholder="https://hooks.slack.com/services/..."
              textareaClassName="min-h-28"
            />
            <TextField
              label="Channel name"
              hint="Optional override, for example #qa-reports"
              value={value.slack.channel_name}
              onChange={(event) => onChange({ ...value, slack: { ...value.slack, channel_name: event.target.value } })}
              placeholder="#qa-reports"
            />
            <Button type="button" variant="outline" onClick={() => onSendTest("slack")}>
              Send Slack Test
            </Button>
          </>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <MattermostIcon />
            Mattermost webhook
          </div>
          <Switch
            checked={value.mattermost.enabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, mattermost: { ...value.mattermost, enabled: checked } })
            }
          />
        </div>
        {value.mattermost.enabled ? (
          <>
            <TextareaField
              hint="Incoming webhook URL"
              value={value.mattermost.webhook_url}
              onChange={(event) =>
                onChange({ ...value, mattermost: { ...value.mattermost, webhook_url: event.target.value } })
              }
              placeholder="https://mattermost.example/hooks/..."
              textareaClassName="min-h-28"
            />
            <TextField
              label="Channel name"
              hint="Optional override, for example town-square"
              value={value.mattermost.channel_name}
              onChange={(event) =>
                onChange({ ...value, mattermost: { ...value.mattermost, channel_name: event.target.value } })
              }
              placeholder="town-square"
            />
            <Button type="button" variant="outline" onClick={() => onSendTest("mattermost")}>
              Send Mattermost Test
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationRuleCard({
  title,
  description,
  value,
  emailAvailable = true,
  showEmailChannel = true,
  onChange,
  onSendTest,
}: NotificationRuleCardProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">Enabled</span>
          <Switch checked={value.enabled} onCheckedChange={(checked) => onChange({ ...value, enabled: checked })} />
        </div>
      </div>

      {value.enabled ? (
        <NotificationRuleCardEnabledFields
          value={value}
          emailAvailable={emailAvailable}
          showEmailChannel={showEmailChannel}
          onChange={onChange}
          onSendTest={onSendTest}
        />
      ) : null}
    </div>
  );
}
