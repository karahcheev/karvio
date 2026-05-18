# Datasets

This section covers API endpoints for datasets, test case dataset bindings, and dataset revisions.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Subsections

| Topic | Reference |
| --- | --- |
| Dataset list, create, update, delete | [Dataset Endpoints](datasets.md) |
| Test case dataset links | [Bindings](bindings.md) |
| Dataset revision history | [Revisions](revisions.md) |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/datasets?project_id={id}` | List datasets with filters and pagination. |
| `POST` | `/datasets` | Create a dataset and its first revision. |
| `POST` | `/datasets/bulk` | Bulk delete datasets. |
| `GET` | `/datasets/{dataset_id}` | Get dataset with current revision. |
| `PATCH` | `/datasets/{dataset_id}` | Update metadata, status, columns, rows; creates a new revision when table data changes. |
| `DELETE` | `/datasets/{dataset_id}` | Delete dataset and remove bindings. |
| `GET` | `/datasets/{dataset_id}/revisions` | List revisions. |
| `GET` | `/datasets/{dataset_id}/revisions/{revision_number}` | Get a specific revision. |
| `GET` | `/test-cases/{test_case_id}/dataset-bindings` | List dataset bindings for a test case. |
| `POST` | `/test-cases/{test_case_id}/dataset-bindings` | Link a dataset to a test case. |
| `PATCH` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Update alias, mode, pinned revision, row selection, sort order. |
| `DELETE` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Remove dataset binding from a test case. |

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
