# Users

This page covers user administration, password management, and personal API key endpoints.

All paths are relative to `/api/v1`. Requests require authentication.

## User Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users` | List users. |
| `POST` | `/users` | Create a user. |
| `GET` | `/users/{user_id}` | Get a user. |
| `PATCH` | `/users/{user_id}` | Update user metadata, role, or enabled state. |
| `DELETE` | `/users/{user_id}` | Delete or disable a user according to service rules. |
| `PUT` | `/users/{user_id}/password` | Set another user's password. |
| `PUT` | `/users/me/password` | Change the current user's password. |

## List Users

`GET /users` supports:

- `page`, `page_size` up to `200`;
- `search` – username, email, name, or team;
- `sort_by`: `created_at`, `updated_at`, `id`, `username`, `email`, `team`, `project_count`, `is_enabled`, `last_login_at`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/users?search=qa&page=1&page_size=50&sort_by=username&sort_order=asc
```

## Create User

```http
POST /api/v1/users
Content-Type: application/json
```

```json
{
  "username": "qa.lead",
  "email": "qa.lead@example.com",
  "full_name": "QA Lead",
  "team": "Quality",
  "password": "temporary-password",
  "is_superuser": false,
  "is_enabled": true
}
```

User administration permissions depend on the current user's global role.

## Personal API Key Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users/me/api-keys` | List current user's API keys. |
| `POST` | `/users/me/api-keys` | Create an API key and return the secret once. |
| `PATCH` | `/users/me/api-keys/{api_key_id}` | Update key metadata, such as name or expiration. |
| `POST` | `/users/me/api-keys/{api_key_id}/regenerate` | Generate a new secret for an existing key. |
| `DELETE` | `/users/me/api-keys/{api_key_id}` | Revoke an API key. |

Create API keys from the current user's context:

```http
POST /api/v1/users/me/api-keys
Content-Type: application/json
```

```json
{
  "name": "CI Pipeline - GitHub Actions",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

The secret is returned only once. See [Authorization](authorization.md) for request authentication examples.

## Required Permissions

| Operation | Permission Rule |
| --- | --- |
| List, create, delete, or administer users | Global `admin` role. |
| Get or patch another user | Global `admin` role. |
| Get or patch own user profile | The authenticated user. |
| Change another user's password | Global `admin` role. |
| Change own password | The authenticated user. |
| Manage `/users/me/api-keys` | The authenticated user who owns the keys. |

Project roles such as `viewer`, `tester`, and `lead` do not grant user administration access by themselves.

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
