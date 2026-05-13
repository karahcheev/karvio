# Getting Started

Use this section to deploy Karvio, understand the object model, and complete the first end-to-end testing workflow.

![First project dashboard after login](<../images/First login.png>)

---

## Before You Begin

Karvio is designed for teams that already have a release or sprint testing process and want to centralize execution evidence. Before onboarding users, decide:

| Decision | Why it matters |
|----------|----------------|
| **Project boundaries** | Projects are the main security and data boundary. Use one project per product, application, or isolated delivery stream. |
| **Suite structure** | Suites become the long-term navigation model for the test repository. Keep them stable and feature-oriented. |
| **Execution statuses** | Agree when testers should use Failed, Blocked, Not Applicable, and In Progress. Consistent status use improves reporting. |
| **Environment naming** | Environment names appear in runs, dashboards, and history. Use names that include platform or target details when needed. |
| **Defect workflow** | Decide whether failures should create Jira issues immediately or only after triage. |

---

## Setup Path

1. [Install Karvio](installation.md) with Docker Compose.
2. Log in as the bootstrap administrator if you enabled bootstrap during setup.
3. Create or review the first project.
4. Add users and assign project roles.
5. Create suites and a small set of representative test cases.
6. Create a run and record results.
7. Configure Jira, JUnit import, notifications, and API keys when the core workflow is stable.

---

## System Requirements

Karvio is distributed as a set of Docker containers. You need:

- Docker Engine 24+ and Docker Compose v2.
- A Linux, macOS, or Windows host with at least 2 GB of free RAM for a small evaluation deployment.
- Outbound internet access for pulling Docker images.
- A reachable hostname or reverse proxy if users will access Karvio outside the host machine.
- SMTP credentials if you want email notifications.
- Jira API credentials if you want defect creation and issue sync.

---

## What to Read Next

| Goal | Page |
|------|------|
| Deploy the system | [Installation](installation.md) |
| Complete the first workflow | [Quick Start](quick-start.md) |
| Understand the data model | [Key Concepts](concepts.md) |
| Prepare project access | [Users and Permissions](../user-guide/project-users/users.md) |
| Connect automation results | [JUnit XML Import](../user-guide/integrations/junit-xml.md) |
