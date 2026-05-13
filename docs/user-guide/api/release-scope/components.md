# Components

## List Components

```http
GET /api/v1/components?project_id=<project-id>&page=1&page_size=50
```

Query parameters:

| Parameter | Description |
| --- | --- |
| `project_id` | Required project id. |
| `status` | Repeated filter: `active`, `archived`. |
| `risk_level` | Repeated filter: `low`, `medium`, `high`, `critical`. |
| `search` | Search by name, key, description. |
| `tag` | Repeated tag filter. |
| `product_id` | Repeated filter by linked products. |
| `page`, `page_size` | Pagination. `page_size` up to `200`. |

## Create Component

```http
POST /api/v1/components
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "name": "Checkout",
  "key": "CHK",
  "description": "Checkout flow and order placement",
  "owner_id": "user-uuid",
  "status": "active",
  "tags": ["payments", "release"],
  "business_criticality": 5,
  "change_frequency": 4,
  "integration_complexity": 4,
  "defect_density": 3,
  "production_incident_score": 4,
  "automation_confidence": 2
}
```

Risk factors must be in the range `0-5`. `risk_score` and `risk_level` are calculated by the server.

## Get, Update, Delete Component

```http
GET /api/v1/components/{component_id}
PATCH /api/v1/components/{component_id}
DELETE /api/v1/components/{component_id}
```

Patch body can contain metadata and risk factors. When risk factors change, `risk_score` and `risk_level` are recalculated.

## Component Dependencies

```http
GET /api/v1/components/{component_id}/dependencies
PUT /api/v1/components/{component_id}/dependencies
```

`PUT` fully replaces dependencies.

```json
{
  "dependencies": [
    {
      "target_component_id": "component-uuid",
      "dependency_type": "depends_on"
    }
  ]
}
```

The API rejects self-dependencies, dependencies on components from another project, and replacements that create dependency cycles.

## Component Graph

```http
GET /api/v1/components/graph?project_id=<project-id>
```

The response contains all project components and dependency edges.

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
