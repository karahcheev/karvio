# Bulk Operations, Permissions, and API

This page covers bulk actions, role requirements, lifecycle rules, and API links for Test Cases.

## Bulk Operations

Selecting rows in the table opens the bulk toolbar. Users can:

- bulk edit;
- bulk delete;
- clear selection.

Bulk edit can apply:

- suite;
- status;
- owner;
- tag;
- priority.

Example: after reviewing 40 draft cases, a QA lead assigns owners, adds `release-2026.05`, and moves selected cases to `Active`.

## Export

Test cases can be exported into formats accepted by popular test management systems. The `Export` control in the test cases toolbar and the `Actions -> Export as ...` menu on the case detail page both offer:

- `CSV (TestRail / Zephyr / qTest)`;
- `TestLink XML`;
- `Xray / Zephyr JSON`;
- `JUnit XML`;
- `JSON` (full-fidelity Karvio format for backup and re-import).

Export is available to any `viewer`.

### What Gets Exported

From the case detail page, export produces a file for that single case.

From the toolbar, the scope depends on the current selection:

- **With rows selected** – only the selected cases are exported. List filters are ignored. The button label shows the count, for example `Export (12)`.
- **With no rows selected** – every case that matches the **current list view** is exported: the selected suite (including nested suites), status and priority filters, and the search query.

Important scope rules:

- If no suite, filters, or search are active, **all cases in the project are exported**, including `Draft` and `Archived`. The status filter is applied only when it is set explicitly in the UI.
- A single export is limited to **10,000 test cases**. A larger filtered set is truncated to the first 10,000.

Example: to share the release-critical checkout suite with a team that uses TestRail, select the `Checkout` suite, filter to `Active`, leave all rows unselected, and choose `Export -> CSV`.

## Permissions

| Action | Minimum Role |
| --- | --- |
| View test cases and steps | `viewer` |
| Export test cases (single or bulk) | `viewer` |
| Create and edit case content | `tester` |
| Change status through allowed lifecycle transitions | Depends on transition; lead and manager cover publish/archive workflows |
| Delete test cases | `lead` |
| Edit datasets from the case tab | `tester` |
| Delete datasets | `lead` |

## Lifecycle

Supported status transitions:

- `draft -> active`;
- `active -> archived`.

`archived` is terminal in the standard lifecycle.

## API

Endpoint tables, query parameters, payload examples, step management, component coverage fields, and bulk operations are documented in [Test Cases API](../api/test-cases/index.md).
