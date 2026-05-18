# Projects

Projects are the top-level organizational units in Karvio. All test cases, runs, plans, milestones, and environments belong to a single project. Access to data is always scoped to the project a user is a member of.

Use separate projects when data, users, release cycles, or reporting need to be isolated.

![Projects page](<../../images/Projects page.png>)

---

## Project List

The main **Projects** page (shown after login) lists all projects you are a member of. Each row shows the project name, description, and member count.

Administrators see all projects in the system, regardless of membership.

---

## Create a Project

1. On the Projects page, click **New Project**.
2. Fill in the details:

| Field | Description |
|-------|-------------|
| **Name** | The project name (required) |
| **Description** | Optional notes about the project's scope |

3. Click **Create**.

You are automatically added to the project as an administrator.

![New project form](<../../images/New project form.png>)

---

## Edit Project Settings

1. Open the project.
2. Go to **Settings** → **General** in the left sidebar.
3. Update the **Name** or **Description**.
4. Click **Save**.

---

## Manage Project Members

See [Users](users.md) for full details on adding team members and assigning roles.

---

## Project Setup Checklist

After creating a project:

1. Add project members and assign roles.
2. Create a first suite structure.
3. Add environments used by the team.
4. Create milestones for the active release or sprint.
5. Configure Jira mapping if defects should be created from failures.
6. Configure notifications if the team wants result alerts.

![Project settings](<../../images/Project settings.png>)

---

## Delete a Project

!!! danger
    Deleting a project permanently removes all test cases, runs, plans, results, milestones, environments, and attachments in that project. This action cannot be undone.

Only system administrators can delete projects.

1. Open the project.
2. Go to **Settings** → **General**.
3. Scroll to the **Danger Zone** section.
4. Click **Delete Project**.
5. Type the project name to confirm, then click **Delete**.
