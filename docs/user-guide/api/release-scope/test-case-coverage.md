# Test Case Coverage

Release Scope uses component coverage fields from Test Cases. Create or update a test case with `primary_product_id` and `component_coverages`:

```json
{
  "primary_product_id": "product-uuid",
  "component_coverages": [
    {
      "component_id": "component-uuid",
      "coverage_type": "direct",
      "coverage_strength": "regression",
      "is_mandatory_for_release": true,
      "notes": "Covers checkout happy path for release acceptance"
    }
  ]
}
```

Supported values:

| Field | Values |
| --- | --- |
| `coverage_type` | `direct`, `indirect`, `integration`, `e2e` |
| `coverage_strength` | `smoke`, `regression`, `deep` |
| `is_mandatory_for_release` | `true`, `false` |

Referenced components must belong to the same project as the test case.

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
