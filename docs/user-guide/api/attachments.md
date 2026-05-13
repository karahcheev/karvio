# Attachments

This page covers file attachments for test cases, structured steps, draft steps, and run items.

All paths are relative to `/api/v1`. Requests require authentication and access to the owning project resource.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/attachments` | List attachments for exactly one target. |
| `POST` | `/attachments` | Upload an attachment to exactly one target. |
| `GET` | `/attachments/{attachment_id}` | Download an attachment. |
| `DELETE` | `/attachments/{attachment_id}` | Delete attachment metadata and stored content. |

## Required Permissions

| Operation | Minimum Role |
| --- | --- |
| List attachments | `viewer` on the owning project. |
| Download attachment | `viewer` on the owning project. |
| Upload attachment | `tester` on the owning project. |
| Delete attachment | `tester` on the owning project. |

The project is resolved from the attachment target: test case, step, draft step, or run item (`run_case` in the API).

## Attachment Targets

List and upload requests must identify exactly one target.

| Target | Parameters |
| --- | --- |
| Test case | `test_case_id` |
| Structured step | `step_id` |
| Run item | `run_case_id` |
| Draft step | `test_case_id` + `draft_step_client_id` |

Invalid or mixed target combinations return `422`.

## List Attachments

```http
GET /api/v1/attachments?test_case_id=tc_1
```

```http
GET /api/v1/attachments?test_case_id=tc_1&draft_step_client_id=draft_step_1
```

### Query Parameters

| Parameter | Required | Notes |
| --- | --- | --- |
| `test_case_id` | Conditional | Use by itself for case attachments or with `draft_step_client_id`. |
| `step_id` | Conditional | Use by itself for structured step attachments. |
| `run_case_id` | Conditional | Use by itself for run item attachments. |
| `draft_step_client_id` | Conditional | Requires `test_case_id`. |

### Response Schema

```json
{
  "items": [
    {
      "id": "att_1",
      "filename": "checkout.png",
      "content_type": "image/png",
      "size": 98213,
      "checksum_sha256": "4a7d...",
      "created_at": "2026-05-13T10:15:00Z",
      "target": {
        "type": "test_case",
        "test_case_id": "tc_1"
      }
    }
  ]
}
```

This endpoint is not paginated.

## Upload Attachment

Upload requests use `multipart/form-data`:

```http
POST /api/v1/attachments
Content-Type: multipart/form-data
```

### Multipart Fields

| Field | Required | Description |
| --- | --- | --- |
| `file` | Yes | Uploaded file. |
| `test_case_id` | Conditional | Target a test case or draft step. |
| `step_id` | Conditional | Target a structured step. |
| `run_case_id` | Conditional | Target a run item. |
| `draft_step_client_id` | Conditional | Draft step target; requires `test_case_id`. |

### Allowed MIME Types and Extensions

| MIME Type | Extensions |
| --- | --- |
| `image/png` | `.png` |
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/gif` | `.gif` |
| `image/webp` | `.webp` |
| `image/bmp` | `.bmp` |
| `image/tiff` | `.tiff`, `.tif` |
| `application/pdf` | `.pdf` |
| `text/plain` | `.txt`, `.log`, `.md`, `.csv` |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |

Forbidden types include `text/html`, `application/xhtml+xml`, `image/svg+xml`, `text/xml`, and `application/xml`.

### File Size Limits

The effective limit is the smaller of the target owner limit and MIME category limit.

| Target | Owner Limit |
| --- | --- |
| Test case | 50 MB |
| Structured step | 10 MB |
| Draft step | 10 MB |
| Run item | 10 MB |

| MIME Category | Category Limit |
| --- | --- |
| Images | 10 MB |
| PDF and Office documents | 50 MB |
| Text files | 1 MB |

Examples: a `.png` on a test case is limited to 10 MB; a `.pdf` on a structured step is limited to 10 MB; a `.log` is limited to 1 MB.

### Upload Response

Successful upload returns `201` and the same `AttachmentRead` shape used by list responses.

## Download Attachment

```http
GET /api/v1/attachments/att_1
```

The response streams the stored file and sets `Content-Disposition` with the original filename.

## Delete Attachment

```http
DELETE /api/v1/attachments/att_1
```

Deleting an attachment is destructive. It removes both metadata and stored file content and queues an audit event. The response is `204 No Content`.

## Status Codes

| Status | Meaning |
| --- | --- |
| `200` | List or download succeeded. |
| `201` | Upload succeeded. |
| `204` | Delete succeeded. |
| `401` | Authentication is missing or invalid. |
| `403` | User lacks the required project role. |
| `404` | Attachment or target resource was not found. |
| `413` | File exceeds the effective size limit. |
| `415` | MIME type, extension, or MIME/extension pair is not allowed. |
| `422` | Target parameters are missing, mixed, or invalid. |

## Error Examples

### Mixed Target Parameters

```json
{
  "type": "https://tms.local/errors/attachment_target_invalid",
  "title": "Validation error",
  "status": 422,
  "detail": "Invalid target combination. Use exactly one: test_case_id, step_id, run_case_id, or test_case_id+draft_step_client_id",
  "instance": "/api/v1/attachments",
  "code": "attachment_target_invalid",
  "request_id": "req_123",
  "errors": {
    "target": ["Invalid or mixed target parameters"]
  }
}
```

### Unsupported File Type

```json
{
  "type": "https://tms.local/errors/attachment_type_not_allowed",
  "title": "Unsupported media type",
  "status": 415,
  "detail": "File type 'application/octet-stream' is not in the allowed whitelist",
  "instance": "/api/v1/attachments",
  "code": "attachment_type_not_allowed",
  "request_id": "req_123"
}
```

## Idempotency and Retries

Upload is not idempotent. Retrying a timed-out upload can create a second attachment if the first request reached the server. Use the returned `checksum_sha256` and target attachment list to de-duplicate client-side when retrying.

Delete is idempotent only after the first successful response from the client's perspective. A later retry can return `404` because the attachment was already removed.

## Rate Limits

Karvio does not currently enforce application-level rate limits for attachment endpoints. Use reverse proxy or gateway throttling for large installations.
