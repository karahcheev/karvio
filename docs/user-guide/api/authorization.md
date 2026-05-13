# Authorization

Karvio API requests must be authenticated. For automation and integrations, use a personal API key instead of a username and password.

API keys are tied to the user who created them and inherit that user's project permissions. A request can access only the projects and resources that the key owner can access in Karvio.

!!! screenshot "SCREENSHOT TODO: API keys list"
    Add a screenshot of the API Keys page with key names, creation dates, expiration dates, and revoke actions.

## How to Get an API Key

1. Click your avatar or username in the top-right corner.
2. Select **API Keys** or go to **Settings** -> **API Keys**.
3. Click **New API Key**.
4. Enter a clear name, for example `CI Pipeline – GitHub Actions`.
5. Optionally set an expiration date.
6. Click **Create**.
7. Copy the secret value immediately and store it in a secure place.

!!! warning "Copy the secret now"
    The secret value is shown only once immediately after creation. You cannot retrieve it again later. Store it in a secrets manager, CI secret, or another secure vault.

!!! screenshot "SCREENSHOT TODO: API key secret shown once"
    Add a screenshot of the post-creation secret dialog with sensitive value masked.

## Authenticate Requests

Send the API key secret in the `Authorization` header using the Bearer scheme:

```http
Authorization: Bearer <your-api-key-secret>
```

Example with `curl`:

```bash
curl -H "Authorization: Bearer <your-api-key-secret>" \
     https://karvio.example.com/api/v1/projects
```

For JSON requests, include the content type as usual:

```bash
curl -X POST https://karvio.example.com/api/v1/test-runs \
  -H "Authorization: Bearer <your-api-key-secret>" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"proj_1","name":"Nightly smoke"}'
```

## Session Cookie Authentication

Browser requests made from an authenticated Karvio session can use the existing session cookie. Use API keys for scripts, CI jobs, importers, scheduled jobs, and any non-browser integration.

## Session Endpoints

These endpoints are used by the web application and browser-based clients.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Authenticate with username/password and set the session cookie. |
| `POST` | `/auth/logout` | Clear the session cookie. |
| `GET` | `/auth/me` | Return the current authenticated user and memberships. |

`POST /auth/login` returns the user object and sets an HTTP-only session cookie. API clients that do not run in a browser should use an API key instead.

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "username": "qa.lead",
  "password": "correct-horse-battery-staple"
}
```

`GET /auth/me` accepts either the active session cookie or a Bearer token accepted by the backend authentication dependency.

## Revocation and Rotation

Revoked keys are invalid immediately. Requests using a revoked key return `401 Unauthorized`.

To rotate a key:

1. Create a new API key.
2. Update the consuming script, CI secret, or integration configuration.
3. Verify the integration with the new key.
4. Revoke the old key.

## Best Practices

- Create one key per integration or automation workflow.
- Use a dedicated integration user when audit ownership should be separate from a human account.
- Grant the key owner access only to the required projects.
- Set expiration dates for temporary or short-lived workflows.
- Never commit API key secrets to version control.

## Required Permissions

| Endpoint | Authentication | Permission Rule |
| --- | --- | --- |
| `POST /auth/login` | None before request | Valid username/password for an enabled user. |
| `POST /auth/logout` | Session cookie recommended | Clears the browser session cookie; no project role required. |
| `GET /auth/me` | Session cookie or Bearer token | Returns the authenticated user's profile and memberships. |

API keys inherit the project memberships and global role of the user who created them.

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
