# System

This page covers lightweight system endpoints.

All paths are relative to `/api/v1`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/version` | Return the backend application version. |
| `GET` | `/metrics` | Return Prometheus metrics text. |

`GET /version` returns:

```json
{
  "version": "0.1.0"
}
```

`GET /metrics` is excluded from the OpenAPI schema and returns Prometheus text format for scraping.

## Required Permissions

| Endpoint | Authentication | Permission Rule |
| --- | --- | --- |
| `GET /version` | None | Public lightweight version endpoint. |
| `GET /metrics` | Deployment dependent | Excluded from OpenAPI; protect it at the network, reverse proxy, or Prometheus scrape configuration layer. |

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
