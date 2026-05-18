# Imports and Exports

This page covers JUnit XML imports and test run report exports.

All paths are relative to `/api/v1`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/test-runs/{test_run_id}/imports/junit` | Import JUnit XML into an existing run. |
| `POST` | `/projects/{project_id}/imports/junit` | Import JUnit XML at project level and resolve the target run automatically. |
| `GET` | `/test-runs/{test_run_id}/export?format={format}` | Export a run report as `json`, `pdf`, or `xml`. |

## Required Permissions

| Operation | Minimum Role |
| --- | --- |
| Existing-run JUnit import | `tester` on the run project. |
| Project-level JUnit import | `tester` on the project. |
| Run report export | `viewer` on the run project. |

## Existing-Run JUnit Import

```http
POST /api/v1/test-runs/run_1/imports/junit?dry_run=true&create_missing_cases=false
Content-Type: multipart/form-data
```

### Query Parameters

| Parameter | Default | Description |
| --- | --- | --- |
| `dry_run` | `false` | When `true`, returns matching preview without writing results. |
| `create_missing_cases` | `false` | Creates test cases for unmatched JUnit tests when importing. |

### Multipart Fields

| Field | Required | Description |
| --- | --- | --- |
| `file` | Yes | JUnit XML file. |

### Response Schema

```json
{
  "id": "imp_1",
  "test_run_id": "run_1",
  "target_run": {
    "id": "run_1",
    "name": "Checkout Regression - RC2",
    "match_mode": "explicit"
  },
  "source_filename": "junit.xml",
  "source_content_type": "application/xml",
  "dry_run": true,
  "status": "completed",
  "summary": {
    "total_cases": 120,
    "matched_by_automation_id": 118,
    "matched_by_name": 1,
    "created_test_cases": 0,
    "updated": 0,
    "unmatched": 1,
    "ambiguous": 0,
    "errors": 0
  },
  "created_cases": [],
  "unmatched_cases": [],
  "ambiguous_cases": [],
  "error_cases": [],
  "created_at": "2026-05-13T10:15:00Z"
}
```

## Project-Level JUnit Import

```http
POST /api/v1/projects/proj_1/imports/junit?create_missing_cases=true
Content-Type: multipart/form-data
```

Project-level import resolves a target run from report metadata or filename. If no suitable active run exists, the service can create one according to import matching rules.

Project-level import does not expose `dry_run`; use existing-run import with `dry_run=true` when a preflight preview is required.

## File Limits

JUnit import currently streams uploaded reports to a temporary file and rejects empty files. The backend does not enforce an explicit maximum JUnit upload size. Deployments should enforce request-body limits at the reverse proxy or gateway layer.

## Idempotency and Retry Notes

JUnit imports are not idempotent when `dry_run=false`. A retry after a network timeout can apply the same report twice or create missing cases twice if the first request completed server-side.

Recommended client behavior:

1. Run `dry_run=true` for existing-run imports.
2. Log the returned import id and summary.
3. Retry only when the request failed before receiving an HTTP response.
4. After an uncertain timeout, query the target run before retrying.

## Export Report

```http
GET /api/v1/test-runs/run_1/export?format=pdf
```

### Query Parameters

| Parameter | Values | Description |
| --- | --- | --- |
| `format` | `json`, `pdf`, `xml` | Export format. Defaults to `json`. |

The response body is the exported file. `Content-Disposition` includes the generated filename.

## Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Export succeeded. |
| `201` | Import record was created. |
| `400` | Uploaded file could not be read. |
| `401` | Authentication is missing or invalid. |
| `403` | User lacks the required project role. |
| `404` | Project, run, or related resource was not found. |
| `422` | Empty upload, invalid XML, ambiguous matches, or domain validation failure. |

## Error Examples

### Empty Upload

```json
{
  "type": "https://tms.local/errors/empty_upload",
  "title": "Validation error",
  "status": 422,
  "detail": "Uploaded report file is empty",
  "instance": "/api/v1/test-runs/run_1/imports/junit",
  "code": "empty_upload",
  "request_id": "req_123",
  "errors": {
    "file": ["empty file"]
  }
}
```

### Invalid XML

```json
{
  "type": "https://tms.local/errors/invalid_junit_xml",
  "title": "Validation error",
  "status": 422,
  "detail": "Uploaded file is not valid JUnit XML",
  "instance": "/api/v1/test-runs/run_1/imports/junit",
  "code": "invalid_junit_xml",
  "request_id": "req_123"
}
```

## Destructive Operation Warnings

Imports can update run item statuses, create result history, link dataset snapshots, and create missing test cases. Use dry run before applying results to a shared or release-critical run.
