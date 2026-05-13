# Notification Rules

Notification rules decide which project events send messages to configured recipients.

Use notification rules to keep teams aware of execution milestones and important failures without requiring everyone to watch the run page.

!!! screenshot "SCREENSHOT TODO: Notification settings overview"
    Add a screenshot of project notification rules navigation.

---

## Create Notification Rules

Notification rules are configured per project.

1. Open the project.
2. Go to **Settings** → **Notifications**.
3. Click **New Notification Rule**.
4. Configure the rule:

| Field | Description |
|-------|-------------|
| **Name** | A label for this rule, e.g., `Notify team on run completion` |
| **Event** | The trigger event. |
| **Recipients** | Comma-separated list of email addresses or configured delivery targets. |

5. Click **Save**.

!!! screenshot "SCREENSHOT TODO: New notification rule"
    Add a screenshot of a rule form with event and recipients fields.

---

## Supported Events

| Event | Description |
|-------|-------------|
| **Run Completed** | Triggered when all items in a run have been recorded |
| **Run Item Failed** | Triggered when a single test item is marked as Failed |
| **Run Item Blocked** | Triggered when a single test item is marked as Blocked |

---

## Test a Notification Rule

After creating a rule:

1. Open the rule.
2. Click **Send Test Notification**.

A test message is sent to the configured recipients immediately.

!!! screenshot "SCREENSHOT TODO: Test notification result"
    Add a screenshot showing a successful test notification.

---

## Edit or Delete a Notification Rule

1. Go to **Settings** → **Notifications**.
2. Click the rule you want to change.
3. Edit the fields and click **Save**, or click **Delete** to remove the rule.
