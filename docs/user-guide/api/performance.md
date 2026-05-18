# Performance

This page covers performance test runs, artifact imports, saved comparisons, public comparison links, and artifact downloads.

All paths are relative to `/api/v1`.

## Endpoints

### Performance Runs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/perf/runs?project_id={id}` | List performance runs. |
| `POST` | `/perf/runs` | Create a performance run. |
| `GET` | `/perf/runs/{run_id}` | Get a performance run. |
| `PATCH` | `/perf/runs/{run_id}` | Update performance run metadata or lifecycle fields. |

### Imports

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/perf/imports/validate?project_id={id}` | Validate an uploaded performance artifact before import. |
| `POST` | `/perf/imports?project_id={id}` | Start an asynchronous performance import. |
| `GET` | `/perf/imports/{import_id}` | Get import status and result details. |

### Comparisons and Artifacts

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/perf/comparisons?project_id={id}` | List saved comparisons. |
| `POST` | `/perf/comparisons` | Create a saved comparison. |
| `GET` | `/perf/comparisons/{comparison_id}` | Get a saved comparison. |
| `PATCH` | `/perf/comparisons/{comparison_id}` | Update comparison metadata or visibility. |
| `DELETE` | `/perf/comparisons/{comparison_id}` | Delete a saved comparison. |
| `GET` | `/public/perf/comparisons/{token}` | Read a public comparison without authentication. |
| `GET` | `/performance-artifacts/{artifact_id}` | Download an imported performance artifact. |

## Required Permissions

| Operation | Minimum Role |
| --- | --- |
| List or read performance runs | `viewer` |
| Create or update performance runs | `tester` |
| Validate or start performance import | `tester` |
| Read import status | `viewer` |
| Create or update saved comparisons | `tester` |
| Delete saved comparisons | `tester` or stricter project policy when configured |
| Download performance artifacts | `viewer` on the owning project |
| Read public comparison | No authentication; possession of public token is sufficient |

## List Performance Runs

`GET /perf/runs` supports:

- required `project_id`;
- repeated `status`;
- repeated `verdict`;
- repeated `load_kind`;
- repeated `environment`;
- `search`;
- `include_archived`;
- `page` and `page_size` up to `200`;
- `sort_by`: `created_at`, `started_at`, `name`, `status`, `verdict`, `load_kind`, `env`;
- `sort_order`: `asc`, `desc`.

Paginated responses include `items`, `page`, `page_size`, and `has_next`.

## Import Request Schema

Import requests use `multipart/form-data` with a required `file` field.

```http
POST /api/v1/perf/imports/validate?project_id=proj_1
Content-Type: multipart/form-data
```

```http
POST /api/v1/perf/imports?project_id=proj_1
Content-Type: multipart/form-data
```

The validate endpoint parses enough content to return metadata without creating a performance run. The import endpoint stores the source artifact and starts asynchronous processing.

## Upload Limits

| Extension | Full Import Limit | Validate Limit |
| --- | ---: | ---: |
| `.zip` | 250 MB | 32 MB |
| `.json` | 50 MB | 8 MB |
| `.csv` | 100 MB | 16 MB |
| `.html`, `.htm` | 20 MB | 4 MB |
| `.txt`, `.log` | 20 MB | 4 MB |
| Other allowed extension fallback | 20 MB | 8 MB |

Allowed MIME/extension pairs:

- `application/zip` or `application/x-zip-compressed` with `.zip`;
- `application/json` with `.json`;
- `text/csv` with `.csv`;
- `text/plain` with `.txt` or `.log`;
- `text/html` with `.html` or `.htm`;
- `application/octet-stream` with `.zip`, `.json`, `.csv`, `.txt`, `.html`, or `.log`.

Zip imports also enforce archive safety limits: at most 400 non-directory entries, each selected member up to 55 MB uncompressed, and compression ratio checks to reduce zip-bomb risk.

## Response Schema

Performance run responses include metadata, status, verdict, load kind, timing, summary metrics, baseline, regressions, transaction metrics, error buckets, artifacts, import record, environment snapshot, archive state, creator, and timestamps.

Import responses include import id, status, source metadata, parser/adapter details, discovered artifacts, missing data, parse status, and issues.

## Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Read, patch, validate, or download succeeded. |
| `201` | Performance run or comparison was created. |
| `202` | Performance import was accepted for asynchronous processing. |
| `204` | Saved comparison was deleted. |
| `400` | Uploaded artifact could not be read. |
| `401` | Authentication is missing or invalid. |
| `403` | User lacks the required project role. |
| `404` | Run, import, comparison, public token, or artifact was not found. |
| `413` | Upload exceeds the configured size limit. |
| `415` | MIME type or extension is not allowed. |
| `422` | Payload or domain validation failed. |

## Error Example

```json
{
  "type": "https://tms.local/errors/performance_artifact_too_large",
  "title": "Payload too large",
  "status": 413,
  "detail": "File exceeds maximum allowed size of 52428800 bytes",
  "instance": "/api/v1/perf/imports",
  "code": "performance_artifact_too_large",
  "request_id": "req_123"
}
```

## Idempotency and Retry Notes

Performance imports are not idempotent. Retrying after an uncertain timeout can create another import record. Check `/perf/imports/{import_id}` when an id was returned, and check recent performance runs before retrying after a connection failure.

Validation requests are safe to retry because they do not create runs.

## Destructive Operation Warnings

Deleting a saved comparison removes the saved comparison record. Imported performance artifacts remain governed by the owning performance run and artifact storage behavior.

## Rate Limits

Karvio does not currently enforce application-level rate limits for performance endpoints. Use gateway or reverse proxy throttling for large uploads or public comparison traffic.
