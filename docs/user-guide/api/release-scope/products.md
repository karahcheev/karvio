# Products

## List Products

```http
GET /api/v1/products?project_id=<project-id>&page=1&page_size=50
```

Query parameters:

| Parameter | Description |
| --- | --- |
| `project_id` | Required project id. |
| `status` | Repeated filter: `active`, `archived`. |
| `search` | Search by name, key, description. |
| `tag` | Repeated tag filter. |
| `page`, `page_size` | Pagination. `page_size` up to `200`. |

List responses include `items`, `page`, `page_size`, `has_next`, and `total`. Product list items may include `summary_snapshot` with total, covered, uncovered, high-risk uncovered, and mandatory case counts.

## Create Product

```http
POST /api/v1/products
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "name": "Web App",
  "key": "WEB",
  "description": "Customer-facing web application",
  "owner_id": "user-uuid",
  "status": "active",
  "tags": ["release", "customer-facing"]
}
```

`key`, `description`, `owner_id`, `status`, and `tags` are optional. If `key` is omitted, Karvio generates a unique key.

## Get, Update, Delete Product

```http
GET /api/v1/products/{product_id}
PATCH /api/v1/products/{product_id}
DELETE /api/v1/products/{product_id}
```

Patch body can contain `name`, `key`, `description`, `owner_id`, `status`, and `tags`.

## Product-Component Links

```http
GET /api/v1/products/{product_id}/components
PUT /api/v1/products/{product_id}/components
```

`PUT` fully replaces product-component links.

```json
{
  "links": [
    {
      "component_id": "component-uuid",
      "is_core": true,
      "sort_order": 10
    }
  ]
}
```

All linked components must belong to the same project as the product.

## Product Summary

```http
GET /api/v1/products/{product_id}/summary
```

Summary includes component totals, covered/inadequately covered/uncovered counts, high-risk uncovered count, total cases, mandatory release cases, smoke/regression/deep counts, manual/automated counts, coverage scores, and per-component breakdown.

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
