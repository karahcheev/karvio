# AI

This page covers the AI test case assistant and AI settings endpoints.

All paths are relative to `/api/v1`. Requests require authentication. AI endpoints also require the project to have effective AI settings.

## Test Case Assistant

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/ai/test-cases/status` | Get AI feature status for the current user and optional project. |
| `POST` | `/ai/test-cases/generate` | Generate draft test cases from a prompt or source context. |
| `POST` | `/ai/test-cases/{test_case_id}/review` | Review an existing test case. |
| `POST` | `/ai/test-cases/duplicates/check` | Check candidate test cases for duplicates. |

`GET /ai/test-cases/status` accepts optional `project_id`.

Duplicate checks require viewer access to the payload project and configured AI provider settings.

## AI Settings

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/settings/ai` | List AI settings overview for manageable projects. |
| `GET` | `/settings/ai/global` | Get global AI settings. |
| `PUT` | `/settings/ai/global` | Update global AI settings. |
| `GET` | `/settings/ai/{project_id}` | Get project AI settings. |
| `PUT` | `/settings/ai` | Update project AI settings. |
| `DELETE` | `/settings/ai/{project_id}` | Remove project AI settings and fall back to global/env config. |

Global AI settings are restricted to superadmin users. Project AI settings are restricted to users who can manage that project.

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
