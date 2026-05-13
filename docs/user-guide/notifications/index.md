# Notifications

Karvio notification settings are split into delivery channels and project-level rules.

Use this section when you need to configure how messages are sent and which project events should notify the team.

## Delivery Model

Karvio currently sends notifications through email, Slack-compatible webhooks, and Mattermost-compatible webhooks.

System SMTP settings are global. Project notification settings decide which events are enabled, which channels receive messages, and which recipients or webhook targets are used for one project.

| Page | Use it to |
|------|-----------|
| [Email](email.md) | Configure SMTP and test email delivery. |
| [Slack](slack.md) | Plan or document Slack delivery for team channels. |
| [Notifications](notifications.md) | Create, test, edit, and delete project notification rules. |

## Setup Checklist

1. Configure SMTP from [Email](email.md) if any project will send email.
2. Confirm webhook URLs and channel names for Slack or Mattermost delivery.
3. Create project notification settings from [Notifications](notifications.md).
4. Enable the event rules the team wants to receive.
5. Send a test notification for each enabled channel.
6. Check worker logs if messages are queued but not delivered.

## Events and Channels

| Event | Purpose | Channels |
| --- | --- | --- |
| `test_run_report` | Sends a run report after a test run is completed. | Email, Slack, Mattermost |
| `alerting` | Sends operational alert-style messages from supported project workflows. | Email, Slack, Mattermost |

## Permissions

| Area | Minimum Role |
| --- | --- |
| Read project notification settings | `viewer` |
| Create, update, or test project notification settings | `lead` |
| Create, update, or test system SMTP settings | System `admin` |

For the shared role definitions, see [Role & Permissions](../permissions.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Email test fails | Confirm SMTP host, port, credentials, sender address, TLS mode, and `timeout_seconds`. |
| Slack or Mattermost test fails | Confirm the webhook URL, channel target, and outbound network access from the backend or worker container. |
| Project rule cannot be saved | Confirm the current user has `lead` access in the project. |
| Completed runs do not send reports | Confirm the `test_run_report` rule is enabled and the background worker is running. |

Use the production log commands in [Installation](../../getting-started/installation.md#logs) to inspect `backend` and `procrastinate-worker` output.
