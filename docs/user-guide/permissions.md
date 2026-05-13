# Role and Permission Model

Karvio uses global user roles and project membership roles. Global roles control administration. Project roles control access to project-scoped testing data.

## Global Roles

| Role | Can Do |
| --- | --- |
| Admin | Manage users, create and administer projects, access project resources as an administrator, and configure system-level settings. |
| Standard user | Sign in and work only in projects where they have membership. |

Global admin rights do not replace good project hygiene. Use a small number of admin accounts and create separate project memberships for day-to-day QA work when audit ownership matters.

## Project Roles

| Role | Can Do |
| --- | --- |
| Viewer | Read project resources such as test cases, suites, plans, runs, datasets, environments, reports, and audit history. |
| Tester | Create and edit testing resources, record results, import reports, upload attachments, and run normal execution workflows. |
| Lead | Perform destructive or scope-changing actions such as delete, archive, bulk delete, and lead-owned cleanup operations. |
| Manager | Highest project role. Includes lead capabilities and is intended for project-level governance and release ownership. |

Roles are ordered: `viewer < tester < lead < manager`. Admin users can pass project role checks without an explicit membership.

## Common Permission Patterns

| Action Type | Typical Minimum Role |
| --- | --- |
| Read lists, details, history, reports, exports | `viewer` |
| Create or edit test cases, runs, plans, datasets, environments | `tester` |
| Record run results or import automation output | `tester` |
| Upload or delete attachments | `tester` |
| Archive or delete project-scoped resources | `lead` |
| Bulk delete or destructive cleanup | `lead` |
| Manage users | global `admin` |
| Manage project membership | global `admin` or project owner flow where supported |

Individual API pages may document stricter requirements. Always follow the endpoint-specific rule when it differs from this overview.

## Destructive Operations

Karvio distinguishes between archive, delete, and remove:

- **Archive** hides a resource from active workflows while preserving history.
- **Delete** permanently removes a resource or its metadata and should be treated as destructive.
- **Remove** usually means unlinking or taking an item out of a container, such as removing a run item from a test run.

Prefer archive when historical traceability matters.

## API Keys

API keys inherit the permissions of the user who created them. For CI and integrations:

- create a dedicated user when audit ownership should be separate from a human account;
- grant only the project roles needed by the integration;
- rotate keys periodically;
- revoke unused keys immediately.

## Related Documentation

- [Authorization API](api/authorization.md)
- [Users and Permissions](project-users/users.md)
- [API Reference](api/index.md)
