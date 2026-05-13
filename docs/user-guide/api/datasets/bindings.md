# Bindings

Dataset bindings link datasets to test cases and define revision and row-selection behavior.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/test-cases/{test_case_id}/dataset-bindings` | List dataset bindings for a test case. |
| `POST` | `/test-cases/{test_case_id}/dataset-bindings` | Link a dataset to a test case. |
| `PATCH` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Update alias, mode, pinned revision, row selection, sort order. |
| `DELETE` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Remove dataset binding from a test case. |

## Bind Dataset to Test Case

```http
POST /api/v1/test-cases/{test_case_id}/dataset-bindings
Content-Type: application/json
```

```json
{
  "dataset_id": "dataset_checkout_cards",
  "dataset_alias": "payment_cards",
  "mode": "pin_revision",
  "pinned_revision_number": 3,
  "row_selection_type": "subset",
  "selected_row_keys": ["visa_eur_success", "mastercard_usd_declined"],
  "sort_order": 10
}
```

Binding modes:

- `follow_latest` – the test case uses the current dataset revision;
- `pin_revision` – the test case uses a specific revision; `pinned_revision_number` is required.

Row selection:

- `all` – use all active rows;
- `subset` – use only `selected_row_keys`; the list is required.

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
