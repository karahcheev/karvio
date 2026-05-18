# Test Runs

This section covers API endpoints for test runs, run cases, execution rows, reruns, JUnit imports, and report export.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Subsections

| Topic | Reference |
| --- | --- |
| Run lifecycle and report export | [Runs](runs.md) |
| Run item scope and assignment | [Run Cases](run-cases.md) |
| Dataset-driven execution rows | [Rows](rows.md) |
| Failed or subset reruns | [Reruns](reruns.md) |
| JUnit import and run export | [Imports & Exports](imports-exports.md) |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/test-runs?project_id={id}` | List runs with filters, sorting, and pagination. |
| `POST` | `/test-runs` | Create a run. |
| `GET` | `/test-runs/{test_run_id}` | Get a run with summary and status breakdown. |
| `PATCH` | `/test-runs/{test_run_id}` | Update metadata or perform a status transition. |
| `DELETE` | `/test-runs/{test_run_id}` | Delete a run. |
| `GET` | `/test-runs/{test_run_id}/export?format=json` | Export run report as `json`, `pdf`, or `xml`. |
| `POST` | `/test-runs/{test_run_id}/imports/junit` | Import JUnit XML into an existing run. |
| `POST` | `/projects/{project_id}/imports/junit` | Project-level JUnit import. |
| `GET` | `/run-cases?test_run_id={id}` | List run items. |
| `POST` | `/run-cases` | Add one test case to a run. |
| `POST` | `/run-cases/bulk` | Add cases by list or suite. |
| `GET` | `/run-cases/{run_case_id}` | Get run item with execution history. |
| `PATCH` | `/run-cases/{run_case_id}` | Update assignee or comment. |
| `DELETE` | `/run-cases/{run_case_id}` | Remove run item from run. |
| `GET` | `/run-cases/{run_case_id}/rows` | List execution rows for a run item. |
| `PATCH` | `/run-cases/rows/{run_case_row_id}` | Update a specific execution row. |
| `POST` | `/run-cases/{run_case_id}/rerun` | Create rows for failed/subset rerun. |

## Required Permissions

Unless a more specific rule is stated above, read endpoints require `viewer`, create and update endpoints require `tester`, and destructive endpoints require `lead` or the stricter role enforced by the owning service.

## Request and Response Schemas

Use the examples on this page together with the generated OpenAPI schema at `/docs` or `/redoc` for exact field types. JSON endpoints use `application/json`; upload endpoints use `multipart/form-data`; resource ids are passed as path parameters.

## Status Codes and Errors

Common responses are `200` for reads and updates, `201` for creates, `204` for successful deletes, `401` for missing authentication, `403` for insufficient project role, `404` for missing or inaccessible resources, and `422` for validation errors.

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

GET requests are safe to retry. POST, PATCH, DELETE, bulk operations, and imports are not guaranteed to be idempotent unless the endpoint explicitly says so. After a network timeout on a write request, read the affected resource before retrying.

## Limits and Destructive Operations

Karvio does not currently enforce application-level rate limits. File upload limits are documented on upload-specific pages. Delete, archive, unlink, and bulk delete operations can remove data or hide it from active workflows; confirm project scope and permissions before calling them from automation.
