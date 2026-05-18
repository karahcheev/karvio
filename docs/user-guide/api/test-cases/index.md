# Test Cases

This section covers API endpoints for suites, test case catalog management, structured steps, component coverage, and bulk operations.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Subsections

| Topic | Reference |
| --- | --- |
| Suite tree and suite lifecycle | [Suites](suites.md) |
| Test case list, create, read, update, delete | [Cases](cases.md) |
| Structured step read and replace operations | [Steps](steps.md) |
| Bulk case operations | [Bulk Operations](bulk-operations.md) |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/suites?project_id={id}` | List suites with parent/search filters and pagination. |
| `POST` | `/suites` | Create a suite. |
| `GET` | `/suites/{suite_id}` | Get a suite. |
| `PATCH` | `/suites/{suite_id}` | Update suite metadata, parent, or sort order. |
| `DELETE` | `/suites/{suite_id}` | Delete a suite and clean up owned attachments. |
| `GET` | `/test-cases?project_id={id}` | List test cases with filters, sorting, and pagination. |
| `POST` | `/test-cases` | Create a test case. |
| `GET` | `/test-cases/{test_case_id}` | Get a test case. |
| `PATCH` | `/test-cases/{test_case_id}` | Update fields, template payload, lifecycle status, or component coverage. |
| `DELETE` | `/test-cases/{test_case_id}` | Delete a test case and its attachments. |
| `GET` | `/test-cases/{test_case_id}/steps` | Get structured steps and step attachments. |
| `PUT` | `/test-cases/{test_case_id}/steps` | Replace structured steps. |
| `POST` | `/test-cases/bulk` | Run a bulk operation on test cases. |

## Component Coverage

Test cases connect to release scope through `primary_product_id` and `component_coverages`. See [Test Case Coverage](../release-scope/test-case-coverage.md) for the field semantics.

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
