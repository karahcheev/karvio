# Environments

This page covers API endpoints for environments, topology payloads, and environment revisions.

All paths are relative to `/api/v1`. Requests require authentication and project membership.

## Endpoints

| Method | Path | Purpose | Minimum Role |
| --- | --- | --- | --- |
| `GET` | `/environments?project_id={id}` | List environments with filters, sorting, and pagination. | `viewer` |
| `GET` | `/environments/use-cases?project_id={id}` | List use case values for filters. | `viewer` |
| `POST` | `/environments` | Create an environment and initial revision. | `tester` |
| `GET` | `/environments/{environment_id}` | Get environment. | `viewer` |
| `PATCH` | `/environments/{environment_id}` | Update environment and create a new revision when topology or metadata changes. | `tester` |
| `DELETE` | `/environments/{environment_id}` | Archive environment. | `lead` |
| `GET` | `/environments/{environment_id}/revisions` | List revisions. | `viewer` |
| `GET` | `/environments/{environment_id}/revisions/{revision_number}` | Get a specific revision. | `viewer` |

## List Query Parameters

`GET /environments` supports:

- `project_id`;
- `include_archived` – default `false`;
- `search` – name or description;
- repeated `use_case`;
- `page`, `page_size` up to `200`;
- `sort_by`: `created_at`, `updated_at`, `name`;
- `sort_order`: `asc`, `desc`.

```http
GET /api/v1/environments?project_id=proj_1&use_case=performance&sort_by=updated_at&sort_order=desc
```

## Topology Payload

Environment topology has three sections:

- `load_generators`;
- `system_under_test`;
- `supporting_services`.

Each section contains components. A component contains nodes, endpoints, tags, and metadata.

### Request Body

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `project_id` | Yes on create | string | Project scope. |
| `name` | Yes on create | string | Environment name. Empty strings are rejected. |
| `kind` | No | string | Defaults to `custom`; common values include `functional`, `performance`, or team-specific kinds. |
| `status` | No | string | Defaults to `active`; common values include `active`, `maintenance`, and `archived`. |
| `description` | No | string or null | Free-form context. |
| `tags` | No | string array | Normalized and deduplicated. |
| `use_cases` | No | string array | Used by filters and reports. |
| `topology` | No | object | Contains `load_generators`, `system_under_test`, `supporting_services`, and `metadata`. |
| `meta` | No | object | Operational metadata. |
| `extra` | No | object | Extension data. |

Extra top-level fields are rejected on create and patch. Component and node objects allow extra fields for environment-specific topology data.

## Create Environment

```http
POST /api/v1/environments
Content-Type: application/json
```

```json
{
  "project_id": "proj_1",
  "name": "staging-eu-payments",
  "kind": "functional",
  "status": "active",
  "description": "EU staging environment for checkout and payment regression.",
  "tags": ["staging", "eu", "prod-like"],
  "use_cases": ["functional", "regression", "release"],
  "topology": {
    "system_under_test": [
      {
        "name": "checkout-api",
        "component_type": "api",
        "endpoints": ["https://checkout.staging-eu.example.com"],
        "tags": ["checkout"],
        "metadata": {
          "service": "checkout"
        },
        "nodes": [
          {
            "name": "checkout-api-blue",
            "host_type": "kubernetes",
            "role": "primary",
            "provider": "aws",
            "region": "eu-central-1",
            "endpoint": "https://checkout.staging-eu.example.com",
            "count": 3,
            "resources": {
              "cpu": "2",
              "memory": "4Gi"
            },
            "tags": ["blue"],
            "metadata": {
              "namespace": "checkout-staging"
            }
          }
        ]
      }
    ],
    "supporting_services": [
      {
        "name": "payment-sandbox",
        "component_type": "managed_service",
        "endpoints": ["https://payments-sandbox.example.com"],
        "tags": ["payments"],
        "metadata": {},
        "nodes": [
          {
            "name": "payment-sandbox-eu",
            "host_type": "cloud_service",
            "role": "sandbox",
            "provider": "external",
            "region": "eu",
            "endpoint": "https://payments-sandbox.example.com",
            "count": 1,
            "resources": {},
            "tags": ["external"],
            "metadata": {}
          }
        ]
      }
    ],
    "load_generators": [],
    "metadata": {}
  },
  "meta": {
    "owner_team": "payments-qa",
    "change_window": "weekday"
  },
  "extra": {
    "notes": "Use only test payment credentials."
  }
}
```

## Patch Environment

```http
PATCH /api/v1/environments/{environment_id}
Content-Type: application/json
```

```json
{
  "status": "maintenance",
  "description": "Temporarily unavailable during payment provider migration.",
  "tags": ["staging", "eu", "maintenance"],
  "use_cases": ["functional"],
  "meta": {
    "owner_team": "payments-qa",
    "maintenance_ticket": "OPS-2451"
  }
}
```

`PATCH` can update any subset of:

- `name`;
- `kind`;
- `status`;
- `description`;
- `tags`;
- `use_cases`;
- `topology`;
- `meta`;
- `extra`.

When topology or metadata changes, the backend creates a new revision snapshot.

## Environment Response

Environment responses include the current revision summary and topology counters:

```json
{
  "id": "env_staging_eu",
  "project_id": "proj_1",
  "name": "staging-eu-payments",
  "kind": "functional",
  "status": "active",
  "description": "EU staging environment for checkout and payment regression.",
  "tags": ["staging", "eu", "prod-like"],
  "use_cases": ["functional", "regression", "release"],
  "schema_version": 1,
  "topology": {
    "load_generators": [],
    "system_under_test": [],
    "supporting_services": [],
    "metadata": {}
  },
  "meta": {
    "owner_team": "payments-qa"
  },
  "extra": {},
  "current_revision_number": 7,
  "current_revision_id": "envrev_42",
  "snapshot_hash": "sha256:example",
  "entities_count": 4,
  "edges_count": 3,
  "topology_component_count": 2,
  "topology_node_count": 4,
  "topology_endpoint_count": 2,
  "infra_host_types": ["kubernetes", "cloud_service"],
  "infra_providers": ["aws", "external"],
  "infra_regions": ["eu-central-1", "eu"],
  "created_by": "user_qa_1",
  "updated_by": "user_qa_1",
  "archived_at": null,
  "created_at": "2026-05-13T09:00:00Z",
  "updated_at": "2026-05-13T09:30:00Z"
}
```

## Revision Response

Environment revision includes:

- `revision_number`;
- `schema_version`;
- `is_current`;
- `revision_note`;
- `full_snapshot`;
- `snapshot_hash`;
- `entities`;
- `edges`;
- `created_by`;
- `created_at`.

Use revisions when a run must be reproducible or when comparing environment drift between executions.

## Curl Examples

Create an environment:

```bash
curl -sS -X POST "$KARVIO_URL/api/v1/environments" \
  -H "Authorization: Bearer $KARVIO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj_1",
    "name": "staging-eu-payments",
    "kind": "functional",
    "status": "active",
    "use_cases": ["functional", "regression"],
    "topology": {
      "system_under_test": [
        {
          "name": "checkout-api",
          "component_type": "api",
          "endpoints": ["https://checkout.staging-eu.example.com"],
          "nodes": [
            {
              "host_type": "kubernetes",
              "provider": "aws",
              "region": "eu-central-1",
              "count": 3
            }
          ]
        }
      ]
    }
  }'
```

List active performance environments:

```bash
curl -sS "$KARVIO_URL/api/v1/environments?project_id=proj_1&use_case=performance&include_archived=false&page=1&page_size=50" \
  -H "Authorization: Bearer $KARVIO_TOKEN"
```

Archive an environment:

```bash
curl -sS -X DELETE "$KARVIO_URL/api/v1/environments/env_staging_eu" \
  -H "Authorization: Bearer $KARVIO_TOKEN"
```

## Required Permissions

Read endpoints require `viewer`, create and update endpoints require `tester`, and archive requires `lead`.

## Request and Response Schemas

Use the concrete request and response examples on this page together with the generated OpenAPI schema at `/docs` or `/redoc` for exact field constraints. Environment endpoints use `application/json`; resource ids are passed as path parameters.

## Status Codes and Errors

Common responses are `200` for reads and updates, `201` for creates, `204` for successful archives, `401` for missing authentication, `403` for insufficient project role, `404` for missing or inaccessible resources, and `422` for validation errors.

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

GET requests are safe to retry. `POST` and `PATCH` are not guaranteed to be idempotent because a successful write can create a revision snapshot. `DELETE /environments/{environment_id}` is safe to retry after success because an already archived environment returns without changing it again.

## Limits and Destructive Operations

Karvio does not currently enforce application-level rate limits. Archive hides the environment from normal selection lists but preserves historical run references and revision records.

## Related UI Workflows

- [Environments](../environments/index.md)
- [Create Environment](../environments/create.md)
- [Environment Details](../environments/details.md)
- [Permissions and API](../environments/permissions-api.md)
