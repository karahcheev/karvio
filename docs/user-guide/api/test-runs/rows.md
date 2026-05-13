# Rows

Execution rows represent dataset-driven scenarios for a run item.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/run-cases/{run_case_id}/rows` | List execution rows for a run item. |
| `PATCH` | `/run-cases/rows/{run_case_row_id}` | Update a specific execution row. |

## List Run Case Rows

```http
GET /api/v1/run-cases/rc_1/rows?status=failure&page=1&page_size=100
```

Rows represent dataset-driven scenarios for a run item. `page_size` is supported up to `500`, which is useful for automation syncing many dataset rows.

## Update Run Case Row Result

```http
PATCH /api/v1/run-cases/rows/{run_case_row_id}
Content-Type: application/json
```

```json
{
  "status": "failure",
  "comment": "Payment confirmation page did not open after successful provider callback.",
  "defect_ids": ["PAY-4812"],
  "actual_result": "User remains on checkout page with spinner for more than 60 seconds.",
  "system_out": "provider_callback=200 order_status=pending",
  "system_err": "Timeout waiting for order confirmation event",
  "executed_by": "user_qa_1",
  "finished_at": "2026-05-11T10:30:00Z",
  "duration_ms": 840000
}
```

Updating a row records history and recalculates aggregate status/counts for the run item.

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
