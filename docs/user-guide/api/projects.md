# Projects & Members

This page covers project registry endpoints and project membership management.

All paths are relative to `/api/v1`. Requests require authentication.

## Project Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/projects` | List projects visible to the current user. |
| `POST` | `/projects` | Create a project. |
| `GET` | `/projects/{project_id}` | Get project details. |
| `PATCH` | `/projects/{project_id}` | Update project metadata. |
| `DELETE` | `/projects/{project_id}` | Delete a project. |

## List Projects

`GET /projects` supports:

- `page`, `page_size` up to `200`;
- `sort_by`: `created_at`, `id`, `name`, `members_count`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/projects?page=1&page_size=50&sort_by=created_at&sort_order=desc
```

## Create Project

```http
POST /api/v1/projects
Content-Type: application/json
```

```json
{
  "name": "Mobile Checkout",
  "key": "MOB",
  "description": "Mobile app checkout validation"
}
```

Project create and delete permissions depend on the current user's global role.

## Project Member Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/project-members?project_id={id}` | List members in a project. |
| `POST` | `/project-members` | Add a user to a project. |
| `GET` | `/project-members/{project_member_id}` | Get one membership. |
| `PATCH` | `/project-members/{project_member_id}` | Update a member role. |
| `DELETE` | `/project-members/{project_member_id}` | Remove a user from a project. |

## List Project Members

`GET /project-members` supports:

- `project_id` – required project scope;
- `page`, `page_size` up to `200`;
- `sort_by`: `created_at`, `role`, `username`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/project-members?project_id=proj_1&sort_by=username&sort_order=asc
```

## Add Project Member

```http
POST /api/v1/project-members
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "user_id": "user_qa_1",
  "role": "tester"
}
```

Project roles are enforced by the backend for all project-scoped resources.

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
