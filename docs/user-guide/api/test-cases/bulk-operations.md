# Bulk Operations

Use bulk operations to update or delete multiple test cases in one request.

## Endpoint

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/test-cases/bulk` | Run a bulk operation on test cases. |

## Request

```http
POST /api/v1/test-cases/bulk
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "test_case_ids": ["tc_1", "tc_2", "tc_3"],
  "action": "update",
  "suite_id": "suite_checkout",
  "owner_id": "user_qa_2",
  "tag": "release-2026.05",
  "priority": "high"
}
```

Supported bulk actions:

- `delete`;
- `move`;
- `set_status`;
- `set_owner`;
- `add_tag`;
- `set_priority`;
- `update`.

All target cases must belong to the same `project_id`.

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
