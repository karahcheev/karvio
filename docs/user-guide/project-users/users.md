# Users and Permissions

Karvio has two levels of access control: **system-level** (managed by the admin) and **project-level** (managed per project).

Use system users to control who can log in. Use project membership to control which project data each user can access.

![Users page](<../../images/Users page.png>)

---

## System Users

System users are accounts that can log in to Karvio. User management is available to system administrators under **Settings** → **Users**.

### User List

The Users page shows all accounts in the system. Each row displays the username, email, team, project count, last login date, and account status.

#### Search and Sort

Use the search bar to find users by username or email. Sort the list by creation date, username, or last login.

---

### Create a User

Only system administrators can create new accounts.

1. Go to **Settings** → **Users**.
2. Click **New User**.
3. Fill in the details:

| Field | Description |
|-------|-------------|
| **Username** | Unique login name |
| **Email** | User's email address |
| **Password** | Initial password – the user should change it on first login |
| **Team** | Optional team or department name |

4. Click **Create**.

![Create user form](<../../images/Create user form.png>)

---

### Enable or Disable a User

Disabled accounts cannot log in. Existing data (test results, comments) remains intact.

1. Open the user from the list.
2. Toggle the **Active** switch.
3. Save.

---

### Change a Password

Users can change their own password from their profile settings. Administrators can reset any user's password:

1. Open the user from the Users list.
2. Click **Set Password**.
3. Enter and confirm the new password.
4. Click **Save**.

---

## Project Members

Access to a project's data is controlled by project membership. A user must be added to a project to see or interact with its test cases, runs, and other resources.

### View Project Members

1. Open the project.
2. Go to **Settings** → **Members**.

The Members list shows each member's username, role, and date added.

![Project members list](<../../images/Project members list.png>)

#### Sort

Sort by: creation date, role, or username.

---

### Add a Member

1. In **Settings** → **Members**, click **Add Member**.
2. Search for the user by username or email.
3. Select a **Role**.
4. Click **Add**.

!!! screenshot "SCREENSHOT TODO: Add project member modal"
    Add a screenshot showing user search and role selection.

---

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full project access: manage members, settings, and all data |
| **Manager** | Create and manage runs, plans, milestones, and test cases; cannot manage members or settings |
| **Tester** | Record test results, upload attachments, add comments |
| **Viewer** | Read-only access to all project data |

!!! note
    Role names and exact permission boundaries may vary depending on your organization's Karvio configuration.

---

### Change a Member's Role

1. In **Settings** → **Members**, click the member you want to change.
2. Select the new role from the dropdown.
3. Click **Save**.

---

### Remove a Member

1. In **Settings** → **Members**, click the member.
2. Click **Remove from Project**.
3. Confirm.

Removing a member does not delete their historical contributions (test results, comments, etc.).

---

## Permission Planning

| Team member type | Suggested role |
|------------------|----------------|
| QA lead managing scope and people | Admin or Manager |
| QA engineer executing and maintaining tests | Manager or Tester |
| Developer reviewing failures | Viewer or Tester |
| Product manager reviewing release readiness | Viewer |
| CI automation account | Dedicated user with only required project access |

---

## API Keys

Users can create personal API keys for programmatic access. See [Authorization](../api/authorization.md) for details.
