# Runs

This page covers test run lifecycle endpoints.

## Endpoints

| Method | Path | Purpose | Minimum Role |
| --- | --- | --- | --- |
| `GET` | `/test-runs?project_id={id}` | List runs with filters, sorting, and pagination. | `viewer` |
| `POST` | `/test-runs` | Create a run. | `tester` |
| `GET` | `/test-runs/{test_run_id}` | Get a run with summary and status breakdown. | `viewer` |
| `GET` | `/test-runs/{test_run_id}/export?format={format}` | Export a run report. | `viewer` |
| `POST` | `/test-runs/{test_run_id}/imports/junit` | Import JUnit XML results into a run. | `tester` |
| `PATCH` | `/test-runs/{test_run_id}` | Update metadata or perform a status transition. | `tester`; `lead` for archive transition |
| `DELETE` | `/test-runs/{test_run_id}` | Permanently delete a run. | `lead` |

## Response Fields

Test run responses include:

- `id`, `project_id`, `name`, `description`;
- `environment_id`, `environment_name`, `environment_revision`;
- `milestone_id`, `milestone_name`;
- `build`, `assignee`, `created_by`, `created_by_name`;
- `status`, `started_at`, `completed_at`, `archived_at`;
- `planned_item_count`;
- `summary` and `status_breakdown`.

`environment_revision` is the environment revision stored on the run. It lets integrations distinguish runs that used the same environment name with different configuration snapshots.

## List Query Parameters

`GET /test-runs` supports:

- `project_id` – required project scope;
- repeated `status`: `not_started`, `in_progress`, `completed`, `archived`;
- repeated `environment_id`;
- repeated `milestone_id`;
- `search` – name, build, or environment;
- `created_by`;
- `created_from`;
- `created_to`;
- `page`, `page_size` up to `200`;
- `sort_by`: `created_at`, `name`, `status`, `build`, `environment`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/test-runs?project_id=proj_1&status=in_progress&environment_id=env_staging&sort_by=created_at&sort_order=desc
```

## Create Run

```http
POST /api/v1/test-runs
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "name": "Checkout Regression - RC2",
  "description": "Full checkout regression for release candidate 2.",
  "environment_id": "env_staging_eu",
  "milestone_id": "milestone_2026_05",
  "build": "web-2026.05.0-rc2",
  "assignee": "user_qa_lead"
}
```

After creating a run, add scope with `/run-cases` or `/run-cases/bulk`.

### Request Body

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `project_id` | Yes | string | Project scope. |
| `name` | Yes | string | Run display name. |
| `description` | No | string or null | Free-form context. |
| `environment_id` | No | string or null | Environment must belong to the same project. The current environment revision is captured on the run. |
| `milestone_id` | No | string or null | Milestone must belong to the same project. |
| `build` | No | string or null | Build, version, release candidate, or deployment id. |
| `assignee` | No | string or null | User id responsible for the run. |

Extra fields are rejected.

### Response Body

`201 Created` returns a `TestRunRead` object.

```json
{
  "id": "run_123",
  "project_id": "proj_1",
  "name": "Checkout Regression - RC2",
  "description": "Full checkout regression for release candidate 2.",
  "environment_id": "env_staging_eu",
  "milestone_id": "milestone_2026_05",
  "milestone_name": "May 2026 Release",
  "environment_revision_id": "envrev_42",
  "environment_revision_number": 7,
  "environment_name": "staging-eu-payments",
  "environment_snapshot": {},
  "build": "web-2026.05.0-rc2",
  "assignee": "user_qa_lead",
  "planned_item_count": 0,
  "status": "not_started",
  "created_by": "user_admin",
  "started_at": null,
  "completed_at": null,
  "archived_at": null,
  "summary": {
    "total": 0,
    "passed": 0,
    "error": 0,
    "failure": 0,
    "blocked": 0,
    "in_progress": 0,
    "skipped": 0,
    "xfailed": 0,
    "xpassed": 0,
    "pass_rate": 0
  },
  "status_breakdown": {
    "items": []
  },
  "created_at": "2026-05-13T09:00:00Z",
  "updated_at": "2026-05-13T09:00:00Z"
}
```

## Patch Run

Update metadata:

```http
PATCH /api/v1/test-runs/{test_run_id}
Content-Type: application/json
```

```json
{
  "build": "web-2026.05.0-rc3",
  "description": "Retest after RC3 deployment."
}
```

Start, complete, or archive a run by patching `status`:

```json
{
  "status": "in_progress"
}
```

Allowed transitions:

- `not_started -> in_progress`;
- `in_progress -> completed`;
- `completed -> archived`.

The backend rejects completion while any run item is still `in_progress`. Archiving requires `lead`; other metadata changes and start/complete transitions require `tester`.

### Patchable Fields

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string or null | Update display name. |
| `description` | string or null | Update free-form context. |
| `environment_id` | string | Cannot be patched to `null`; captures the current environment revision. |
| `milestone_id` | string or null | Set or clear milestone link. |
| `build` | string or null | Update build identifier. |
| `assignee` | string or null | Update assignee user id. |
| `status` | enum or null | One of `not_started`, `in_progress`, `completed`, `archived`; only valid transitions are accepted. |
| `started_at` | datetime or null | Optional explicit timestamp for start transition. |
| `completed_at` | datetime or null | Optional explicit timestamp for complete transition. |
| `archived_at` | datetime or null | Optional explicit timestamp for archive transition. |
| `planned_item_count` | integer or null | Must be `>= 0`. |

## Create Run from Test Plan

```http
POST /api/v1/test-plans/tp_checkout_regression/create-run
Content-Type: application/json
```

```json
{
  "name": "Checkout Regression - RC3",
  "description": "Regression scope from saved checkout plan.",
  "environment_id": "env_staging_eu",
  "milestone_id": "milestone_2026_05",
  "build": "web-2026.05.0-rc3",
  "assignee": "user_qa_lead",
  "start_immediately": true
}
```

If `milestone_id` is omitted, the run inherits the milestone from the test plan. If `milestone_id` is `null`, the run has no milestone link.

## Curl Examples

Create a run:

```bash
curl -sS -X POST "$KARVIO_URL/api/v1/test-runs" \
  -H "Authorization: Bearer $KARVIO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1",
    "name": "Checkout Regression - RC2",
    "environment_id": "env_staging_eu",
    "build": "web-2026.05.0-rc2"
  }'
```

List in-progress runs created after a date:

```bash
curl -sS "$KARVIO_URL/api/v1/test-runs?project_id=proj_1&status=in_progress&created_from=2026-05-01&page=1&page_size=50" \
  -H "Authorization: Bearer $KARVIO_TOKEN"
```

Complete a run:

```bash
curl -sS -X PATCH "$KARVIO_URL/api/v1/test-runs/run_123" \
  -H "Authorization: Bearer $KARVIO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

## Required Permissions

Read endpoints require `viewer`, run creation and normal updates require `tester`, archive status transitions require `lead`, and `DELETE /test-runs/{test_run_id}` requires `lead`.

## Request and Response Schemas

Use the concrete request and response examples on this page together with the generated OpenAPI schema at `/docs` or `/redoc` for exact field constraints. JSON endpoints use `application/json`; JUnit imports use `multipart/form-data`; resource ids are passed as path parameters.

## Status Codes and Errors

Common responses are `200` for reads, updates, and exports; `201` for creates and imports; `204` for successful deletes; `401` for missing authentication; `403` for insufficient project role; `404` for missing or inaccessible resources; `409` for invalid lifecycle transitions; and `422` for validation errors.

Invalid transition example:

```json
{
  "type": "https://tms.local/errors/invalid_status_transition",
  "title": "Invalid transition",
  "status": 409,
  "detail": "completed is allowed only from in_progress",
  "instance": "/api/v1/test-runs/run_123",
  "code": "invalid_status_transition",
  "request_id": "req_123"
}
```

Validation example:

```json
{
  "type": "https://tms.local/errors/validation_error",
  "title": "Validation failed",
  "status": 422,
  "detail": "Request contains invalid fields",
  "instance": "/api/v1/example",
  "code": "validation_error",
  "request_id": "req_123",
  "errors": {
    "field": ["Field is required"]
  }
}
```

## Pagination and Filtering

List endpoints that expose `page` and `page_size` use 1-based pagination. Many list endpoints cap `page_size` at `200`; row-oriented endpoints may document a different cap. Filtering examples on this page use repeated query parameters when multiple values are supported.

## Idempotency and Retries

GET requests and exports are safe to retry. `POST /test-runs`, `PATCH /test-runs/{test_run_id}`, `DELETE /test-runs/{test_run_id}`, and JUnit imports are not guaranteed to be idempotent. After a network timeout on a write request, read the affected run before retrying.

JUnit import retries can duplicate created missing cases or result updates if the first request succeeded but the client timed out. Prefer `dry_run=true` before a large import and inspect the returned import summary before running the write import.

## Limits and Destructive Operations

Karvio does not currently enforce application-level rate limits. File upload limits are documented on upload-specific pages and should also be enforced at the reverse proxy with `client_max_body_size`.

`DELETE /test-runs/{test_run_id}` permanently deletes the run. Use the `archived` status transition when the run should be hidden from active workflows but preserved for history.

## Related UI Workflows

- [Run Overview](../../test-runs/overview.md)
- [Add Run Results](../../test-runs/results.md)
- [Test Runs List](../../test-runs/list.md)
- [Permissions and API](../../test-runs/permissions-api.md)
