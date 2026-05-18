# Reports & Imports

This page covers overview dashboard data, overview exports, and project-level JUnit XML imports.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Overview Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/overview` | Return overview dashboard metrics and trends. |
| `GET` | `/projects/{project_id}/overview/export` | Export overview data as a downloadable file. |

## Overview Query Parameters

Both overview endpoints support:

- `created_from` – include runs or events on or after this date;
- `created_to` – include runs or events on or before this date;
- repeated `milestone_id`;
- `top_n` from `1` to `100`, default `8`;
- `granularity`: `day`, `week`, or `month`.

The export endpoint also supports `format`. Supported formats are defined by the backend report service.

```http
GET /api/v1/projects/proj_1/overview?created_from=2026-05-01&created_to=2026-05-31&milestone_id=ms_1&top_n=10&granularity=week
```

```http
GET /api/v1/projects/proj_1/overview/export?format=json
```

## Project-Level JUnit Import

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/projects/{project_id}/imports/junit` | Import JUnit XML into a project. |

Upload requests use `multipart/form-data`:

```http
POST /api/v1/projects/proj_1/imports/junit?create_missing_cases=true
Content-Type: multipart/form-data
```

Form fields:

| Field | Description |
| --- | --- |
| `file` | Required JUnit XML file. |

`create_missing_cases=true` allows the import to create test cases that do not already exist.

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
