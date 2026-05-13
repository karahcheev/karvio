# Environment Permissions and API

Use this page when you need to confirm who can view, change, archive, or read historical environment revisions.

For the shared role definitions, see [Role & Permissions](../permissions.md).

## Permission Matrix

| Workflow | Endpoint | Minimum Role | Notes |
| --- | --- |
| List active environments | `GET /environments?project_id={id}` | `viewer` | Set `include_archived=true` to include archived environments. |
| List environment use cases | `GET /environments/use-cases?project_id={id}` | `viewer` | Used by filters and reporting views. |
| View an environment | `GET /environments/{environment_id}` | `viewer` | Requires membership in the environment project. |
| Create an environment | `POST /environments` | `tester` | Creates revision `1` from the initial topology snapshot. |
| Edit an environment | `PATCH /environments/{environment_id}` | `tester` | Updates metadata and creates a new revision when topology or metadata changes. |
| Archive an environment | `DELETE /environments/{environment_id}` | `lead` | Non-destructive archive; the row remains available for historical references. |
| List revisions | `GET /environments/{environment_id}/revisions` | `viewer` | Revisions are immutable snapshots. |
| View a revision | `GET /environments/{environment_id}/revisions/{revision_number}` | `viewer` | Use this for reproducibility and audit checks. |

## Archive Behavior

`DELETE /environments/{environment_id}` sets `archived_at` and writes an `environment.archive` audit event. It does not remove historical test run references or revision records.

Archived environments are hidden from normal lists unless the caller passes `include_archived=true`. If the environment is already archived, the archive request returns successfully without changing it again.

## Revision Behavior

Karvio stores an environment revision whenever a topology or metadata change needs to be preserved. Test runs store the environment revision id, revision number, name, and snapshot at run creation or when the run environment changes.

Use environment revisions when you need to answer:

- which services, nodes, endpoints, providers, or regions existed during a run;
- whether a failed run used the same topology as a passing run;
- what changed between two executions against the same named environment.

## API

Endpoint tables, query parameters, topology payload structure, create and patch examples, response schemas, and status codes are documented in [Environments API](../api/environments.md).

## Common Errors

| Status | Code | Typical Cause |
| --- | --- | --- |
| `403` | `forbidden` | User is not a project member or does not have the required role. |
| `404` | `not_found` | Environment id does not exist or is outside the caller project scope. |
| `409` | domain-specific conflict | The requested operation conflicts with the current environment state. |
| `422` | `validation_error` | Required topology fields are empty or the request contains unsupported fields. |

## Automation Guidance

Prefer reading the current environment before patching it from automation. `PATCH` requests are not guaranteed to be idempotent because topology changes can create new revision snapshots.

For archive automation, confirm project scope and role first. Archiving removes the environment from normal selection lists, even though historical runs keep their captured revision data.
