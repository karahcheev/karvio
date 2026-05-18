# Steps

Structured steps are managed separately from core test case metadata.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/test-cases/{test_case_id}/steps` | Get structured steps and step attachments. |
| `PUT` | `/test-cases/{test_case_id}/steps` | Replace structured steps. |

## Replace Steps

```http
PUT /api/v1/test-cases/{test_case_id}/steps
Content-Type: application/json
```

```json
{
  "steps": [
    {
      "position": 1,
      "action": "Open checkout page and select saved 3DS card.",
      "expected_result": "Payment method is selected and order summary remains unchanged."
    },
    {
      "position": 2,
      "action": "Confirm payment and complete 3DS challenge.",
      "expected_result": "Order is created, payment status is captured, confirmation page is shown."
    }
  ]
}
```

`PUT /test-cases/{id}/steps` fully replaces the step list. Clients must send the final ordered set.

Step attachments are managed through the [Attachments](../attachments.md) API using `step_id`.

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
