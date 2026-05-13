# Milestones

## List Milestones

```http
GET /api/v1/milestones?project_id=<project-id>&page=1&page_size=50
```

Query parameters:

| Parameter | Description |
| --- | --- |
| `project_id` | Required project id. |
| `status` | Repeated filter: `planned`, `active`, `completed`, `archived`. |
| `search` | Search by name, description, release label. |
| `page`, `page_size` | Pagination. `page_size` up to `200`. |

## Create Milestone

```http
POST /api/v1/milestones
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "name": "Release 2.4",
  "description": "Regression and acceptance scope for v2.4",
  "status": "planned",
  "start_date": "2026-05-01",
  "target_date": "2026-05-20",
  "owner_id": "user-uuid",
  "release_label": "v2.4.0"
}
```

`completed_at` is also supported when exact completion time must be preserved.

## Get, Update, Delete Milestone

```http
GET /api/v1/milestones/{milestone_id}
PATCH /api/v1/milestones/{milestone_id}
DELETE /api/v1/milestones/{milestone_id}
```

Patch body can contain `name`, `description`, `status`, `start_date`, `target_date`, `completed_at`, `owner_id`, and `release_label`.

## Milestone Summary

```http
GET /api/v1/milestones/{milestone_id}/summary
```

Summary includes plan totals, planned case totals, run counts by lifecycle status, run item status counts, pass rate, and overdue status.

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
