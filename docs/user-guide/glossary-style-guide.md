# Glossary and Style Guide

Use this page when writing or reviewing Karvio documentation. It defines the preferred product terms, when API entity names differ from UI names, and the heading style used across the docs.

## Terminology

| Use | Avoid Mixing With | Notes |
| --- | --- | --- |
| Test case | case, test | Use the full term in prose. Use `test_case` only for API fields. |
| Test suite | suite folder | A folder in the Test Cases repository. |
| Test plan | plan | Reusable execution scope. |
| Test run | run | A concrete execution session. |
| Run item | run case | UI term for a test case inside a test run. The API entity is `run_case`. |
| Run case row | row, dataset row result | API and execution term for a dataset-driven row inside a run item. |
| Result | execution update | A status update recorded against a run item or run case row. |
| Attachment | evidence file, artifact | Use Attachment for files uploaded to cases, steps, draft steps, and run items. |
| Artifact | attachment | Use Artifact only for performance imports, generated reports, or automation output. |
| Environment | target, env | Project-level target configuration. Use `env` only in API fields. |
| Environment revision | snapshot | Versioned environment snapshot captured for reproducibility. |
| Topology | environment graph | Components and nodes inside an environment. |
| Archive | delete, remove | Archive hides or retires while preserving history. |
| Delete | archive, remove | Delete is destructive and should carry a warning. |
| Remove | delete | Use Remove for unlinking or taking an item out of a run without deleting the source record. |

## UI and API Naming

Karvio sometimes uses different names in UI and API contracts:

| UI Term | API Term | Explanation |
| --- | --- | --- |
| Run item | `run_case` | The UI emphasizes execution work items. The API keeps the historical entity name. |
| Run item row | `run_case_row` | Row-level result target created from dataset bindings. |
| Test suite | `suite` | Folder-like case organization. |
| Environment revision | `environment_revision` | Immutable snapshot attached to a run. |
| Attachment | `attachment` | Uploaded file metadata and stored content. |

Explain the mapping once in conceptual docs and then use the UI term in user-facing pages and API term in API pages.

## Heading Style

Use English Title Case for headings.

Preferred structure:

```md
# Page Title

## Section Title

### Subsection Title
```

Rules:

- Do not skip levels, such as `#` directly followed by `###`.
- Avoid `UI:` prefixes in page headings; the section title should carry the meaning.
- Keep page titles short and noun-based when possible.
- Use action headings for workflow pages, such as `Create a Test Run`.
- Use `API` uppercase when it is part of a heading.

## Prose Style

- Use product terms consistently from the glossary.
- Use en dash or em dash in prose instead of ASCII hyphen for parenthetical breaks.
- Use ASCII hyphen only for command flags, identifiers, filenames, URLs, and code values.
- Prefer direct sentences over marketing language.
- Use destructive operation warnings before delete or irreversible cleanup behavior.

## API Documentation Checklist

Every leaf API page should cover:

- complete endpoint list;
- required permissions;
- request schema or field table;
- response schema or important response fields;
- status codes;
- error examples;
- pagination and filtering behavior where relevant;
- idempotency and retry notes for import or write endpoints;
- rate limits if the application enforces them, or an explicit note that it does not;
- upload and file size limits for attachment/import endpoints;
- destructive operation warnings for delete, archive, bulk delete, and unlink behavior.
