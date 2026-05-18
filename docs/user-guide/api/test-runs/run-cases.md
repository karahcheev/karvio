# Run Cases

Run cases are the executable items inside a test run.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/run-cases?test_run_id={id}` | List run items. |
| `POST` | `/run-cases` | Add one test case to a run. |
| `POST` | `/run-cases/bulk` | Add cases by list or suite. |
| `GET` | `/run-cases/{run_case_id}` | Get run item with execution history. |
| `PATCH` | `/run-cases/{run_case_id}` | Update assignee or comment. |
| `DELETE` | `/run-cases/{run_case_id}` | Remove run item from run. |

## Response Fields

Run case responses include:

- run/test metadata: `test_run_id`, `test_case_id`, `test_case_key`, `test_case_title`;
- organization fields: `suite_id`, `suite_name`, `priority`, `tags`;
- execution fields: `status`, `assignee_id`, `assignee_name`, `last_executed_at`, `duration_ms`;
- aggregate row counters: `rows_total`, `rows_passed`, `rows_failed`;
- `comment`;
- `external_issues`;
- `history` on detail responses.

The detail endpoint is useful for audit and side panels because it shows how the result changed, who changed it, and which defect/system details were recorded.

## List Query Parameters

`GET /run-cases` supports:

- `test_run_id` – list items from one run;
- `project_id` + `test_case_id` – history for a test case in a project;
- repeated `status`;
- `assignee_id`;
- `search` – test case title;
- `page`, `page_size` up to `200`;
- `sort_by`: `test_case_title`, `suite_name`, `status`, `assignee_name`, `last_executed_at`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/run-cases?test_run_id=run_1&status=failure&sort_by=last_executed_at&sort_order=desc
```

## Add Run Cases

Add one case:

```json
{
  "test_run_id": "run_1",
  "test_case_id": "tc_checkout_card",
  "assignee_id": "user_qa_1"
}
```

Bulk add by case ids:

```json
{
  "test_run_id": "run_1",
  "test_case_ids": ["tc_1", "tc_2", "tc_3"]
}
```

Bulk add by suite:

```json
{
  "test_run_id": "run_1",
  "suite_id": "suite_checkout"
}
```

Bulk create requires exactly one of `test_case_ids` or `suite_id`.

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
