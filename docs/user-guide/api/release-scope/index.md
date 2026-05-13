# Release Scope

This section covers API endpoints for release scope resources: Products, Components, Milestones, Test Plans, generated plan previews, and test case component coverage.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Resources

| Resource | Endpoints |
| --- | --- |
| [Products](products.md) | Product registry, product-component links, product summaries. |
| [Components](components.md) | Component registry, risk factors, dependencies, dependency graph. |
| [Test Case Coverage](test-case-coverage.md) | Test case fields that connect release scope to product and component coverage. |
| [Milestones](milestones.md) | Release, sprint, hotfix, and acceptance-cycle milestones. |
| [Test Plans](test-plans.md) | Manual plans, product-generated plans, generated previews, and run creation from a plan. |

## Roles

| Operation | Minimum project role |
| --- | --- |
| View products, components, milestones, plans, summaries | `viewer` |
| Create and update milestones, test plans, create runs from plans | `tester` |
| Generate test plan previews | `tester` |
| Create, update, delete products/components and their links | `lead` |
| Delete milestones/test plans | `lead` |

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
