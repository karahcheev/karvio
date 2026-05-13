# Datasets

This page covers dataset list, create, update, delete, and bulk delete endpoints.

## Endpoints

| Method | Path | Purpose | Minimum Role |
| --- | --- | --- | --- |
| `GET` | `/datasets?project_id={id}` | List datasets with filters and pagination. | `viewer` |
| `POST` | `/datasets` | Create a dataset and its first revision. | `tester` |
| `POST` | `/datasets/bulk` | Bulk delete datasets. | `lead` |
| `GET` | `/datasets/{dataset_id}` | Get dataset with current revision. | `viewer` |
| `PATCH` | `/datasets/{dataset_id}` | Update metadata, status, columns, rows; creates a new revision when table data changes. | `tester` |
| `DELETE` | `/datasets/{dataset_id}` | Delete dataset and remove bindings. | `lead` |
| `GET` | `/datasets/{dataset_id}/revisions` | List dataset revisions. | `viewer` |
| `GET` | `/datasets/{dataset_id}/revisions/{revision_number}` | Get one dataset revision. | `viewer` |
| `GET` | `/test-cases/{test_case_id}/dataset-bindings` | List dataset bindings for a test case. | `viewer` |
| `POST` | `/test-cases/{test_case_id}/dataset-bindings` | Bind a dataset to a test case. | `tester` |
| `PATCH` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Update a dataset binding. | `tester` |
| `DELETE` | `/test-cases/{test_case_id}/dataset-bindings/{binding_id}` | Remove a dataset binding. | `tester` |

## List Query Parameters

`GET /datasets` supports:

- `project_id`;
- `test_case_id` – return datasets linked to the test case;
- `exclude_test_case_id` – return datasets not yet linked to the test case;
- `search`;
- repeated `source_type`: `manual`, `pytest_parametrize`, `imported`;
- `page`, `page_size` up to `200`.

```http
GET /api/v1/datasets?project_id=proj_1&source_type=manual&search=checkout&page=1&page_size=25
```

## Create Dataset

```http
POST /api/v1/datasets
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "name": "Checkout payment cards",
  "description": "Cards and expected outcomes for checkout payment validation.",
  "source_type": "manual",
  "source_ref": "QA-owned release dataset",
  "columns": [
    {
      "column_key": "card_type",
      "display_name": "card_type",
      "data_type": "string",
      "required": true,
      "is_scenario_label": true
    },
    {
      "column_key": "currency",
      "display_name": "currency",
      "data_type": "string",
      "required": true
    },
    {
      "column_key": "expected_status",
      "display_name": "expected_status",
      "data_type": "string",
      "required": true
    }
  ],
  "rows": [
    {
      "row_key": "visa_eur_success",
      "scenario_label": "Visa EUR succeeds",
      "values": {
        "card_type": "visa_3ds",
        "currency": "EUR",
        "expected_status": "captured"
      },
      "is_active": true
    }
  ],
  "change_summary": "Initial release payment dataset."
}
```

### Request Body

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `project_id` | Yes | string | Project scope. |
| `name` | Yes | string | Dataset name. |
| `description` | No | string or null | Free-form context. |
| `source_type` | No | enum | `manual`, `pytest_parametrize`, or `imported`; defaults to `manual`. |
| `source_ref` | No | string or null | External source reference, file name, or import reference. |
| `columns` | No | array | Column definitions. |
| `rows` | No | array | Row definitions. |
| `change_summary` | No | string or null | Revision note for the initial revision. |

Column fields are `column_key`, `display_name`, `data_type`, `required`, `default_value`, and `is_scenario_label`. Row fields are `row_key`, `scenario_label`, `values`, and `is_active`.

### Response Body

`201 Created` returns a `TestDatasetRead` object.

```json
{
  "id": "dataset_123",
  "project_id": "proj_1",
  "name": "Checkout payment cards",
  "description": "Cards and expected outcomes for checkout payment validation.",
  "status": "active",
  "source_type": "manual",
  "source_ref": "QA-owned release dataset",
  "created_by": "user_qa_1",
  "created_at": "2026-05-13T09:00:00Z",
  "updated_at": "2026-05-13T09:00:00Z",
  "archived_at": null,
  "current_revision_number": 1,
  "current_revision_id": "dsrev_1",
  "current_revision": {
    "id": "dsrev_1",
    "dataset_id": "dataset_123",
    "revision_number": 1,
    "rows_count": 1,
    "change_summary": "Initial release payment dataset.",
    "created_by": "user_qa_1",
    "created_at": "2026-05-13T09:00:00Z",
    "columns": [],
    "rows": []
  },
  "test_case_ids": [],
  "test_cases_count": 0
}
```

## Patch Dataset

```http
PATCH /api/v1/datasets/{dataset_id}
Content-Type: application/json
```

```json
{
  "description": "Cards, currencies, and expected provider outcomes for regression.",
  "columns": [
    {
      "column_key": "card_type",
      "display_name": "card_type",
      "data_type": "string",
      "required": true,
      "is_scenario_label": true
    }
  ],
  "rows": [
    {
      "row_key": "visa_eur_success",
      "scenario_label": "Visa EUR succeeds",
      "values": {
        "card_type": "visa_3ds"
      },
      "is_active": true
    }
  ],
  "change_summary": "Removed obsolete declined card scenario."
}
```

When columns or rows change, the backend creates a new dataset revision.

## Bulk Delete

```http
POST /api/v1/datasets/bulk
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "dataset_ids": ["dataset_1", "dataset_2"],
  "action": "delete"
}
```

Bulk delete returns:

```json
{
  "affected_count": 2
}
```

Bulk delete removes dataset bindings before deleting the dataset records.

## Dataset Bindings

Bind a dataset to a test case:

```http
POST /api/v1/test-cases/{test_case_id}/dataset-bindings
Content-Type: application/json
```

```json
{
  "dataset_id": "dataset_123",
  "dataset_alias": "payment_cards",
  "mode": "pin_revision",
  "pinned_revision_number": 1,
  "row_selection_type": "subset",
  "selected_row_keys": ["visa_eur_success"],
  "sort_order": 10
}
```

Binding enums:

- `mode`: `follow_latest`, `pin_revision`;
- `row_selection_type`: `all`, `subset`.

`pinned_revision_number` is required when `mode=pin_revision`. `selected_row_keys` is required when `row_selection_type=subset`.

## Curl Examples

Create a dataset:

```bash
curl -sS -X POST "$KARVIO_URL/api/v1/datasets" \
  -H "Authorization: Bearer $KARVIO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1",
    "name": "Checkout payment cards",
    "source_type": "manual",
    "columns": [
      {"column_key": "card_type", "display_name": "card_type", "required": true}
    ],
    "rows": [
      {"row_key": "visa_eur_success", "values": {"card_type": "visa_3ds"}}
    ]
  }'
```

List imported datasets linked to a case:

```bash
curl -sS "$KARVIO_URL/api/v1/datasets?project_id=proj_1&test_case_id=tc_123&source_type=imported&page=1&page_size=25" \
  -H "Authorization: Bearer $KARVIO_TOKEN"
```

## Required Permissions

Read endpoints require `viewer`, create and update endpoints require `tester`, and dataset delete or bulk delete endpoints require `lead`.

## Request and Response Schemas

Use the concrete request and response examples on this page together with the generated OpenAPI schema at `/docs` or `/redoc` for exact field constraints. Dataset endpoints use `application/json`; resource ids are passed as path parameters.

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

GET requests are safe to retry. `POST`, `PATCH`, `DELETE`, and bulk operations are not guaranteed to be idempotent. A `PATCH` that changes columns or rows creates a new dataset revision; after a timeout, read the dataset before retrying.

## Limits and Destructive Operations

Karvio does not currently enforce application-level rate limits. Delete and bulk delete operations remove dataset records and bindings; confirm project scope before calling them from automation.

## Related UI Workflows

- [Datasets](../../datasets/index.md)
- [Create and Edit Datasets](../../datasets/create-and-edit.md)
- [Bindings and Revisions](../../datasets/bindings-revisions.md)
