# Cases

This page covers test case catalog list, create, read, update, and delete endpoints.

## Endpoints

| Method | Path | Purpose | Minimum Role |
| --- | --- | --- | --- |
| `GET` | `/test-cases?project_id={id}` | List test cases with filters, sorting, and pagination. | `viewer` |
| `POST` | `/test-cases` | Create a test case. | `tester` |
| `POST` | `/test-cases/bulk` | Move, update, delete, or retag multiple test cases. | Depends on action; delete requires `lead` |
| `GET` | `/test-cases/{test_case_id}` | Get a test case. | `viewer` |
| `PATCH` | `/test-cases/{test_case_id}` | Update fields, template payload, lifecycle status, or component coverage. | `tester` for changes; `viewer` can submit no-op payloads |
| `DELETE` | `/test-cases/{test_case_id}` | Delete a test case and its attachments. | `lead` |
| `GET` | `/test-cases/{test_case_id}/steps` | Get structured steps for a step-based case. | `viewer` |
| `PUT` | `/test-cases/{test_case_id}/steps` | Replace structured steps. | `tester` |

## List Query Parameters

`GET /test-cases` supports:

- `project_id` – required project scope;
- `page`, `page_size` up to `200`;
- `search` – key/title/tags;
- repeated `status`;
- repeated `priority`;
- repeated `suite_id`;
- repeated `tag`;
- `owner_id`;
- repeated `product_id`;
- repeated `component_id`;
- `minimum_component_risk_level`: `low`, `medium`, `high`, `critical`;
- repeated `exclude_test_case_id`;
- `sort_by`: `created_at`, `updated_at`, `key`, `title`, `status`, `priority`, `owner_name`, `suite_name`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/test-cases?project_id=proj_1&status=active&priority=high&component_id=cmp_payment&sort_by=priority&sort_order=desc
```

## Create Test Case

```http
POST /api/v1/test-cases
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "suite_id": "suite_checkout",
  "owner_id": "user_qa_1",
  "primary_product_id": "prod_web",
  "automation_id": "tests.checkout.test_card_payment::test_success",
  "title": "Card payment succeeds for an enrolled 3DS card",
  "template_type": "steps",
  "preconditions": "User has an active account and a cart with one physical item.",
  "time": "12m",
  "priority": "high",
  "test_case_type": "manual",
  "status": "draft",
  "tags": ["checkout", "payment", "3ds", "release-2026.05"],
  "component_coverages": [
    {
      "component_id": "cmp_payment_api",
      "coverage_type": "e2e",
      "coverage_strength": "regression",
      "is_mandatory_for_release": true,
      "notes": "Required for payment release scope."
    }
  ]
}
```

### Request Body

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `project_id` | Yes | string | Project scope. |
| `title` | Yes | string | Test case title. |
| `suite_id` | No | string or null | Suite must belong to the same project. |
| `owner_id` | No | string or null | Owner user id. |
| `primary_product_id` | No | string or null | Primary product under test. |
| `automation_id` | No | string or null | External automated test identifier. |
| `template_type` | No | enum | `text`, `steps`, or `automated`; defaults to `steps`. |
| `steps_text` | Conditional | string or null | Used only by `text` templates. |
| `expected` | Conditional | string or null | Used by `text` templates. |
| `raw_test` | Conditional | string or null | Required by `automated` templates. |
| `raw_test_language` | No | string or null | Language for `raw_test`. |
| `preconditions` | No | string or null | Preconditions shown in the UI. |
| `time` | No | string or null | Estimated execution time. |
| `priority` | No | enum or null | `low`, `medium`, `high`, `critical`. |
| `test_case_type` | No | enum or null | `manual` or `automated`. |
| `status` | No | enum or null | `draft`, `active`, `archived`. |
| `tags` | No | string array | Free-form tags. |
| `component_coverages` | No | array | Product component coverage records. |

Extra fields are rejected. Template payload rules are enforced by `template_type`: `steps` uses structured step endpoints, `text` requires `steps_text` or `expected`, and `automated` requires `raw_test`.

### Response Body

`201 Created` returns a `TestCaseRead` object.

```json
{
  "id": "tc_123",
  "project_id": "proj_1",
  "suite_id": "suite_checkout",
  "owner_id": "user_qa_1",
  "primary_product_id": "prod_web",
  "owner_name": "QA Lead",
  "key": "TC-1042",
  "automation_id": "tests.checkout.test_card_payment::test_success",
  "title": "Card payment succeeds for an enrolled 3DS card",
  "template_type": "steps",
  "steps_text": null,
  "expected": null,
  "raw_test": null,
  "raw_test_language": null,
  "preconditions": "User has an active account and a cart with one physical item.",
  "time": "12m",
  "priority": "high",
  "status": "draft",
  "test_case_type": "manual",
  "tags": ["checkout", "payment", "3ds", "release-2026.05"],
  "dataset_bindings": [],
  "external_issues": [],
  "variables_used": [],
  "component_coverages": [],
  "suite_name": "Checkout",
  "created_at": "2026-05-13T09:00:00Z",
  "updated_at": "2026-05-13T09:00:00Z"
}
```

## Patch Test Case

```http
PATCH /api/v1/test-cases/{test_case_id}
Content-Type: application/json
```

```json
{
  "status": "active",
  "priority": "critical",
  "tags": ["checkout", "payment", "release-blocker"],
  "component_coverages": [
    {
      "component_id": "cmp_payment_api",
      "coverage_type": "direct",
      "coverage_strength": "deep",
      "is_mandatory_for_release": true
    }
  ]
}
```

Referenced suites, owners, products, and components must belong to the same project as the test case.

### Patchable Fields

`PATCH /test-cases/{test_case_id}` accepts the same editable fields as create, all optional. Sending no fields is allowed and returns the current test case after a `viewer` permission check. Sending editable fields requires `tester`.

Changing `template_type` must also respect the template payload rules. For example, an `automated` test case must include `raw_test`; a `text` test case must not include `raw_test`.

## Bulk Operations

```http
POST /api/v1/test-cases/bulk
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "test_case_ids": ["tc_123", "tc_124"],
  "action": "set_status",
  "status": "active"
}
```

Supported actions are `delete`, `move`, `set_status`, `set_owner`, `add_tag`, `set_priority`, and `update`.

| Action | Required Extra Field | Minimum Role |
| --- | --- | --- |
| `delete` | none | `lead` |
| `move` | `suite_id` | `tester` |
| `set_status` | `status` | `tester` |
| `set_owner` | `owner_id` | `tester` |
| `add_tag` | `tag` | `tester` |
| `set_priority` | `priority` | `tester` |
| `update` | one or more supported update fields | `tester` |

Response:

```json
{
  "affected_count": 2
}
```

Bulk delete removes attachments for deleted test cases. Confirm the project scope before using it from automation.

## Curl Examples

Create a test case:

```bash
curl -sS -X POST "$KARVIO_URL/api/v1/test-cases" \
  -H "Authorization: Bearer $KARVIO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1",
    "suite_id": "suite_checkout",
    "title": "Card payment succeeds for an enrolled 3DS card",
    "template_type": "steps",
    "priority": "high",
    "status": "draft",
    "test_case_type": "manual",
    "tags": ["checkout", "payment"]
  }'
```

List active high-priority payment cases:

```bash
curl -sS "$KARVIO_URL/api/v1/test-cases?project_id=proj_1&status=active&priority=high&tag=payment&page=1&page_size=50" \
  -H "Authorization: Bearer $KARVIO_TOKEN"
```

## Required Permissions

Read endpoints require `viewer`, create and update endpoints require `tester`, and destructive endpoints require `lead`. Bulk operations use the role required by the selected action.

## Request and Response Schemas

Use the concrete request and response examples on this page together with the generated OpenAPI schema at `/docs` or `/redoc` for exact field constraints. JSON endpoints use `application/json`; attachment upload endpoints are documented on the attachment API page.

## Status Codes and Errors

Common responses are `200` for reads, updates, and bulk operations; `201` for creates; `204` for successful deletes; `401` for missing authentication; `403` for insufficient project role; `404` for missing or inaccessible resources; `409` for domain conflicts; and `422` for validation errors.

Template validation example:

```json
{
  "type": "https://tms.local/errors/validation_error",
  "title": "Validation failed",
  "status": 422,
  "detail": "Request contains invalid fields",
  "instance": "/api/v1/test-cases",
  "code": "validation_error",
  "request_id": "req_123",
  "errors": {
    "template_type": ["automated template requires raw_test"]
  }
}
```

Standard validation example:

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

GET requests are safe to retry. `POST`, `PATCH`, `DELETE`, and bulk operations are not guaranteed to be idempotent. After a network timeout on a write request, read the affected test case or rerun the list filter before retrying.

## Limits and Destructive Operations

Karvio does not currently enforce application-level rate limits. Attachment limits are documented on the attachment API page and should also be enforced at the reverse proxy.

`DELETE /test-cases/{test_case_id}` and bulk `delete` remove the test case and its attachments. Prefer setting `status` to `archived` when the case should be hidden from active authoring but preserved as catalog history.

## Related UI Workflows

- [Test Case Detail](../../test-cases/detail.md)
- [Create Test Case](../../test-cases/create.md)
- [Test Suites](../../test-cases/suites.md)
- [Datasets](../../datasets/index.md)
