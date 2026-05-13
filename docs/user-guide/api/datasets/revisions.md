# Revisions

Dataset revisions preserve table snapshots when columns or rows change.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/datasets/{dataset_id}/revisions` | List revisions. |
| `GET` | `/datasets/{dataset_id}/revisions/{revision_number}` | Get a specific revision. |

## List Revisions

```http
GET /api/v1/datasets/{dataset_id}/revisions
```

Use this endpoint to inspect historical table versions, audit data changes, or select a revision to pin in a test case binding.

## Get Revision

```http
GET /api/v1/datasets/{dataset_id}/revisions/{revision_number}
```

Revision responses include the revision number, change summary, columns, rows, creation metadata, and whether the revision is current.

`follow_latest` bindings use the dataset's current revision. `pin_revision` bindings keep using the specified revision until the binding is changed.

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
