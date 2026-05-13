# Slack

Slack delivery is the place to document team-channel notification setup when Slack integration is enabled for your Karvio deployment.

Use Slack notifications for shared release or QA channels where the whole team needs visibility into important run events.

!!! note
    If Slack delivery is not enabled in your deployment yet, use [Email](email.md) delivery and project [notification rules](notifications.md) instead.

## Recommended Channel Model

| Channel | Recommended use |
|---------|-----------------|
| Release channel | Run completion, blocked release checks, acceptance status. |
| QA team channel | Failed or blocked run items that need triage. |
| Automation channel | CI imports, JUnit failures, report availability. |
