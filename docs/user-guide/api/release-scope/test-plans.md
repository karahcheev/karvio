# Test Plans

## List Test Plans

```http
GET /api/v1/test-plans?project_id=<project-id>&page=1&page_size=50
```

Query parameters:

| Parameter | Description |
| --- | --- |
| `project_id` | Required project id. |
| `search` | Search by name or description. |
| `tags` | Repeated filter. Plans with any provided tag are returned. |
| `milestone_id` | Repeated milestone filter. |
| `page`, `page_size` | Pagination. `page_size` up to `200`. |

## List Test Plan Tags

```http
GET /api/v1/test-plans/tags?project_id=<project-id>
```

Returns unique tags used by project test plans.

## Create Manual Test Plan

```http
POST /api/v1/test-plans
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "name": "Release 2.4 Regression",
  "description": "Stable regression scope for release 2.4",
  "tags": ["regression", "release"],
  "generation_source": "manual",
  "milestone_id": "milestone-uuid",
  "suite_ids": ["suite-uuid"],
  "case_ids": ["case-uuid"]
}
```

`suite_ids` and `case_ids` can be used together. The API validates that suites and cases belong to the project and are not duplicated.

## Generate Preview from Product Scope

```http
POST /api/v1/test-plans/generate-preview
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "config": {
    "product_ids": ["product-uuid"],
    "component_ids": [],
    "include_dependent_components": true,
    "minimum_risk_level": null,
    "generation_mode": "regression",
    "explicit_include_case_ids": [],
    "explicit_exclude_case_ids": []
  }
}
```

Generation modes:

| Mode | Includes |
| --- | --- |
| `full` | All active cases found by resolved components. |
| `regression` | Active candidate cases by resolved components with `regression_rule`. |
| `smoke` | Mandatory cases, smoke coverage, and cases for high/critical components. |

Config options:

| Field | Description |
| --- | --- |
| `product_ids` | Products whose linked components seed the scope. |
| `component_ids` | Explicitly selected components. |
| `include_dependent_components` | Include dependency expansion. |
| `minimum_risk_level` | Keep only components with at least the selected risk level. |
| `generation_mode` | `smoke`, `regression`, `full`. |
| `explicit_include_case_ids` | Force include active cases. |
| `explicit_exclude_case_ids` | Exclude cases from the result. |

Preview response includes `resolved_component_ids`, `resolved_case_ids`, `included_cases`, `excluded_cases`, and summary counts.

Reason codes in `included_cases`:

| Reason code | Meaning |
| --- | --- |
| `product_match` | Case found through selected product. |
| `component_match` | Case covers selected/base component. |
| `dependency_match` | Case covers dependency component. |
| `risk_threshold` | Component passed minimum risk threshold. |
| `mandatory_release` | Case is mandatory for release. |
| `regression_rule` | Case included by regression mode. |
| `smoke_rule` | Case included by smoke mode. |
| `explicit_include` | Case was explicitly added. |

## Create Product-Generated Test Plan

```http
POST /api/v1/test-plans
Content-Type: application/json
```

```json
{
  "project_id": "project-uuid",
  "name": "Web App generated plan",
  "description": "Generated from product release scope",
  "tags": ["generated", "release"],
  "generation_source": "product_generated",
  "generation_config": {
    "product_ids": ["product-uuid"],
    "component_ids": [],
    "include_dependent_components": true,
    "minimum_risk_level": null,
    "generation_mode": "regression",
    "explicit_include_case_ids": [],
    "explicit_exclude_case_ids": []
  },
  "milestone_id": "milestone-uuid",
  "suite_ids": [],
  "case_ids": []
}
```

For `product_generated`, the server calculates effective `case_ids` from `generation_config`. Payload `case_ids` are not used as a manual list.

## Get, Update, Delete Test Plan

```http
GET /api/v1/test-plans/{test_plan_id}
PATCH /api/v1/test-plans/{test_plan_id}
DELETE /api/v1/test-plans/{test_plan_id}
```

Patch body can change metadata, milestone, suites/cases, and generation settings. If `generation_source` or `generation_config` changes for a generated plan, the server recalculates the case list.

## Create Run from Test Plan

```http
POST /api/v1/test-plans/{test_plan_id}/create-run
Content-Type: application/json
```

```json
{
  "name": "Release 2.4 Regression - RC1",
  "description": "Regression run for RC1",
  "environment_id": "environment-uuid",
  "build": "2.4.0-rc1",
  "assignee": "user-uuid",
  "milestone_id": "milestone-uuid",
  "start_immediately": true
}
```

If `milestone_id` is omitted, the run inherits the milestone from the test plan. If `milestone_id` is `null`, the run has no milestone link.

The API creates a test run, adds active cases from plan suites and explicit cases, removes duplicates, and starts the run when `start_immediately` is `true`.

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
