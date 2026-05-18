# Jira Integration

This page covers Jira system settings, user connections, project mappings, issue links, and sync refresh.

All paths are relative to `/api/v1`. Requests require authentication.

## Settings and Connections

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/jira/settings` | Get Jira system settings. |
| `PUT` | `/integrations/jira/settings` | Update Jira system settings. |
| `POST` | `/integrations/jira/connect/api-token` | Create a Jira connection using configured API token settings. |
| `GET` | `/integrations/jira/connections` | List Jira connections. |
| `PATCH` | `/integrations/jira/connections/{connection_id}` | Update connection metadata or enabled state. |
| `DELETE` | `/integrations/jira/connections/{connection_id}` | Disconnect Jira. |

## Project Mappings

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/jira/mappings` | List Jira project mappings. |
| `POST` | `/integrations/jira/mappings` | Create a project mapping. |
| `PATCH` | `/integrations/jira/mappings/{mapping_id}` | Update a project mapping. |
| `DELETE` | `/integrations/jira/mappings/{mapping_id}` | Delete a project mapping. |

`GET /integrations/jira/mappings` accepts optional `project_id`.

## Issue Resolution and Links

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/integrations/jira/issues/resolve` | Resolve a Jira issue by key. |
| `GET` | `/integrations/jira/issues/links` | List Jira links for an owner resource. |
| `POST` | `/integrations/jira/issues/link` | Link an existing Jira issue to a Karvio resource. |
| `POST` | `/integrations/jira/issues/create-from-run-case` | Create and link a Jira issue from one run case. |
| `POST` | `/integrations/jira/issues/create-from-run-cases` | Create and link Jira issues from multiple run cases. |
| `POST` | `/integrations/jira/issues/link-run-cases` | Link one Jira issue to multiple run cases. |
| `DELETE` | `/integrations/jira/issues/link/{link_id}` | Remove an issue link. |

`GET /integrations/jira/issues/resolve` requires `key` and accepts optional `project_id`.

`GET /integrations/jira/issues/links` requires `owner_type` and `owner_id`.

## Sync

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/integrations/jira/sync/refresh` | Refresh Jira sync state for configured mappings. |

Jira requests call the configured Jira API client. Network or Jira permission failures are returned as integration errors.

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
