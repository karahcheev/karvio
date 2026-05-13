# API Reference

Karvio provides a REST API for CI/CD integrations, automation result imports, release scope management, custom reporting, and internal tooling.

Use this section when you need exact endpoints, query parameters, payload examples, or integration behavior. User-facing workflow documentation stays in the User Guide; API-specific details are collected here.

![Swagger UI](<../../images/Swagger UI.png>)

## Base URL

All endpoints in this reference are relative to:

```text
https://your-karvio-instance.example.com/api/v1
```

For local development this is typically:

```text
http://localhost:<backend-port>/api/v1
```

## Authentication

All API requests require authentication. Use an API key for scripts, CI jobs, importers, and other automation.

```http
Authorization: Bearer <api-key-secret>
```

See [Authorization](authorization.md) for API key creation, storage, rotation, and request examples.

Browser requests made from an authenticated Karvio session can use the existing session cookie.

## Request Format

- JSON endpoints use `Content-Type: application/json`.
- Upload endpoints use `multipart/form-data`.
- Dates and timestamps use ISO 8601.
- Project-scoped list endpoints usually take `project_id` as a query parameter.
- Create endpoints usually take `project_id` in the JSON body.
- Resource-specific operations usually derive project scope from the resource id.

## Pagination

List endpoints return paginated responses. Most project resources support:

| Parameter | Description |
| --- | --- |
| `page` | 1-based page number. |
| `page_size` | Items per page. Many TMS endpoints support up to `200`; some row-level endpoints support higher limits. |

Paginated responses commonly include:

```json
{
  "items": [],
  "page": 1,
  "page_size": 50,
  "has_next": false,
  "total": 0
}
```

## Permissions

API permissions follow project roles.

| Capability | Typical minimum role |
| --- | --- |
| Read project resources, summaries, runs, datasets, environments | `viewer` |
| Create and update test cases, test runs, datasets, environments, milestones, test plans | `tester` |
| Archive or delete lead-owned project resources such as products, components, milestones, plans, datasets, environments, runs | `lead` |

Some endpoints have stricter rules. Each resource page calls out important exceptions.

## Interactive API Docs

Karvio exposes OpenAPI documentation:

```text
https://your-karvio-instance.example.com/docs
```

ReDoc is available at:

```text
https://your-karvio-instance.example.com/redoc
```

![ReDoc API reference](<../../images/redoc.png>)


## API Page Contract

Leaf API pages in this reference should include the following sections when applicable:

| Section | Required Content |
| --- | --- |
| Endpoints | Full method/path list for the resource. |
| Required Permissions | Minimum project role or authentication requirement for each operation group. |
| Request Schema | JSON body, query parameters, path parameters, or multipart fields. |
| Response Schema | Response model or important response fields. |
| Status Codes | Success and expected failure codes. |
| Error Examples | At least one problem response for validation, permission, not found, or unsupported media type. |
| Pagination and Filtering | Page model, max `page_size`, filters, and sorting where supported. |
| Idempotency and Retries | Retry guidance for imports and write endpoints. |
| Limits | File size, MIME type, page size, or service limits. |
| Destructive Operations | Delete/archive/unlink warnings and cleanup behavior. |

## Common Error Shape

Domain and validation errors use a problem-style JSON body:

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

## Common Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Read, update, validation, or export request succeeded. |
| `201` | Resource was created or import record was created. |
| `202` | Asynchronous work was accepted. |
| `204` | Delete or cleanup request succeeded with no response body. |
| `400` | Request could not be processed, often because an uploaded file could not be read. |
| `401` | Authentication is missing or invalid. |
| `403` | Authenticated user lacks the required project role. |
| `404` | Resource was not found or is outside the user's accessible projects. |
| `413` | Uploaded file exceeds the allowed size. |
| `415` | Uploaded file type or extension is not allowed. |
| `422` | Request validation or domain validation failed. |

## Rate Limits

Karvio does not currently enforce application-level API rate limits in the backend. Deployments that need throttling should enforce it at the reverse proxy, API gateway, or load balancer layer.

## Resource References

| Resource area | Reference |
| --- | --- |
| API keys, session login, session logout, current user | [Authorization](authorization.md) |
| Projects and project members | [Projects & Members](projects.md) |
| Users, passwords, personal API keys | [Users](users.md) |
| Products, components, milestones, test plans, release scope generation | [Release Scope](release-scope/index.md) |
| Product registry and product-component links | [Products](release-scope/products.md) |
| Component registry, risk factors, dependency graph | [Components](release-scope/components.md) |
| Component coverage fields on test cases | [Test Case Coverage](release-scope/test-case-coverage.md) |
| Milestones and milestone summaries | [Milestones](release-scope/milestones.md) |
| Test plans, generated previews, run creation | [Test Plans](release-scope/test-plans.md) |
| Test case catalog, steps, component coverage, bulk operations | [Test Cases](test-cases/index.md) |
| Test runs, run cases, execution rows, JUnit import, report export | [Test Runs](test-runs/index.md) |
| Datasets, revisions, test case dataset bindings | [Datasets](datasets/index.md) |
| Environments, topology, revisions | [Environments](environments.md) |
| Attachments for cases, steps, draft steps, and run cases | [Attachments](attachments.md) |
| Overview dashboard data, exports, project-level imports | [Reports & Imports](reports.md) |
| Performance runs, imports, comparisons, public links, artifacts | [Performance](performance.md) |
| Audit event search | [Audit Logs](audit-logs.md) |
| SMTP and project notification settings | [Notifications](notifications.md) |
| Jira settings, mappings, issue links, sync | [Jira Integration](jira.md) |
| AI test case assistant and AI settings | [AI](ai.md) |
| Version and operational metrics | [System](system.md) |

## Integration Checklist

Before connecting a script or CI job:

1. Create a dedicated API key for the integration.
2. Confirm the key owner has access only to required projects.
3. Test against a non-production project first.
4. Add retry handling for transient network or server errors.
5. Log request method, URL, status code, and response body for failed calls.
6. Avoid hard-deleting historical execution data unless the integration owns it.
7. Rotate API keys periodically and revoke unused keys.
